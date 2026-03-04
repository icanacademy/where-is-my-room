# Integration with ICAN Scheduling App

This document explains how "Where Is My Room" connects to the ICAN Scheduling App.

## Overview

**Where Is My Room** is a READ-ONLY display app that shows current room assignments from the scheduling app's database in real-time.

## Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                    ICAN Scheduling App                       │
│                        (Port 5555)                           │
│                                                              │
│  • Teachers create/edit assignments                          │
│  • Full CRUD operations                                      │
│  • Notion integration                                        │
│  • Backup system                                             │
└──────────────────────────────────────────────────────────────┘
                            │
                            │ Writes to
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                  PostgreSQL Database                         │
│                    (scheduling_db)                           │
│                                                              │
│  Tables:                                                     │
│  • assignments (date, time_slot_id, room_id, notes)         │
│  • assignment_teachers (teacher_id, is_substitute)          │
│  • assignment_students (student_id)                         │
│  • teachers (name, availability, color_keyword)             │
│  • students (name, english_name, color_keyword)             │
│  • rooms (47 rooms: 1-37, A1-1, A1-2, etc.)                │
│  • time_slots (12 hourly slots: 8AM-9AM through 8PM-9PM)   │
└──────────────────────────────────────────────────────────────┘
                            │
                            │ Reads from (READ-ONLY)
                            ▼
┌──────────────────────────────────────────────────────────────┐
│                  Where Is My Room App                        │
│                        (Port 5557)                           │
│                                                              │
│  • Queries current assignments                               │
│  • Detects current time slot automatically                   │
│  • Displays room cards with teachers/students                │
│  • Auto-refreshes every 10 seconds                          │
│  • Never modifies database                                   │
└──────────────────────────────────────────────────────────────┘
```

## Database Connection

### Configuration (server/.env)
```env
DB_HOST=localhost
DB_PORT=5432
DB_NAME=scheduling_db
DB_USER=icanacademy
DB_PASSWORD=
```

### Connection Details
- Uses PostgreSQL `pg` driver
- Connection pooling via `pg.Pool`
- READ-ONLY queries only (SELECT statements)
- No INSERT, UPDATE, or DELETE operations

## Key Queries

### 1. Get Current Time Slot
**Logic (server.js:51-76)**
```javascript
function getCurrentTimeSlot() {
  const hour = new Date().getHours();

  // Hourly slots from 8 AM to 9 PM (12 slots total)
  if (hour >= 8 && hour < 12) {
    return hour - 7; // 8am = slot 1, 9am = slot 2, 10am = slot 3, 11am = slot 4
  } else if (hour >= 13 && hour < 21) {
    return hour - 8; // 1pm = slot 5, 2pm = slot 6, ..., 8pm = slot 12
  }

  return null; // Outside class hours or lunch (12-1 PM)
}
```

### 2. Get Room Assignments
**Query (server.js:99-161)**
```sql
SELECT
  a.id,
  a.date,
  a.time_slot_id,
  a.room_id,
  a.notes,
  r.name as room_name,
  r.display_order,
  ts.name as time_slot_name,
  ts.start_time,
  ts.end_time,
  -- Aggregate teachers with substitute flag
  json_agg(DISTINCT jsonb_build_object(
    'id', t.id,
    'name', t.name,
    'color_keyword', t.color_keyword,
    'is_substitute', at.is_substitute
  )) FILTER (WHERE t.id IS NOT NULL) as teachers,
  -- Aggregate students
  json_agg(DISTINCT jsonb_build_object(
    'id', s.id,
    'name', s.name,
    'english_name', s.english_name,
    'color_keyword', s.color_keyword,
    'weakness_level', s.weakness_level
  )) FILTER (WHERE s.id IS NOT NULL) as students
FROM assignments a
INNER JOIN rooms r ON a.room_id = r.id
INNER JOIN time_slots ts ON a.time_slot_id = ts.id
LEFT JOIN assignment_teachers at ON a.id = at.assignment_id
LEFT JOIN teachers t ON at.teacher_id = t.id
LEFT JOIN assignment_students ast ON a.id = ast.assignment_id
LEFT JOIN students s ON ast.student_id = s.id
WHERE a.date = $1
  AND a.time_slot_id = $2
  AND a.is_active = true
GROUP BY a.id, r.name, r.display_order, ts.name, ts.start_time, ts.end_time
ORDER BY r.display_order
```

## Data Flow

### Backend (Every 10 seconds)
1. **Client** calls `GET /api/room-assignments`
2. **Server** calls `getCurrentTimeSlot()` → Determines current time slot ID
3. **Server** calls `getTodayDate()` → Gets current date (YYYY-MM-DD)
4. **Server** queries database with date + time_slot_id
5. **Database** returns assignments with joined teacher/student data
6. **Server** returns JSON response with room cards data

### Frontend Display
1. Receives JSON with assignments array
2. Filters out null teachers/students
3. Extracts nicknames from `[Nickname] Full Name` format
4. Generates room card HTML for each assignment
5. Displays in responsive grid layout
6. Shows:
   - Room number (large, prominent)
   - Teachers (blue badges)
   - Substitute teachers (yellow badges with "SUB")
   - Students (green badges with names)
   - Student count

## API Endpoints

### Primary Endpoint
```
GET /api/room-assignments
Query params:
  - date (optional, defaults to today)
  - timeSlotId (optional, defaults to current time slot)

Response:
{
  "date": "2025-10-30",
  "timeSlotId": 3,
  "timeSlotName": "1PM to 3PM",
  "assignments": [
    {
      "id": 123,
      "room_name": "5",
      "room_id": 5,
      "teachers": [
        {
          "id": 10,
          "name": "[Nick] John Smith",
          "is_substitute": false
        }
      ],
      "students": [
        {
          "id": 50,
          "name": "김민수",
          "english_name": "Mike Kim"
        }
      ]
    }
  ]
}
```

### Helper Endpoints
- `GET /api/current-timeslot` - Get current time slot info
- `GET /api/today-schedule` - Get all assignments for entire day
- `GET /api/search?q=name` - Search for teacher/student

## Safety Features

### Read-Only Access
- ✅ Only SELECT queries
- ✅ No INSERT, UPDATE, DELETE
- ✅ No schema modifications
- ✅ Connection uses icanacademy user (same as scheduling app)

### Error Handling
- ✅ Database connection errors handled gracefully
- ✅ Returns empty array if no assignments
- ✅ Shows "No Classes Right Now" outside class hours
- ✅ Health check endpoint for monitoring

### Data Validation
- ✅ Filters out null/invalid records
- ✅ Checks `is_active = true` flag on assignments
- ✅ Validates time slot range (1-6)
- ✅ Validates date format

## Display Logic

### Time-Based Display
```javascript
if (current_hour < 8 || current_hour >= 21) {
  show "No Classes Right Now"
} else if (no assignments for current time slot) {
  show "No Room Assignments"
} else {
  show room cards with assignments
}
```

### Room Card Structure
```
┌────────────────────────────┐
│      Room 5                │ ← Room number (large)
├────────────────────────────┤
│ 👨‍🏫 Teachers               │
│ [Nick] John (blue badge)   │ ← Teacher name
│ [Sarah] Lee SUB (yellow)   │ ← Substitute
├────────────────────────────┤
│ 👨‍🎓 Students (5)            │
│ 김민수 (Mike Kim)           │ ← Student names
│ 이지은 (Jenny Lee)          │
│ +3 more                    │ ← Overflow indicator
└────────────────────────────┘
```

## Integration Checklist

✅ Database connection configured (server/.env)
✅ PostgreSQL driver installed (`pg` package)
✅ Read-only queries implemented
✅ Current time slot detection
✅ Room card UI designed
✅ Auto-refresh every 10 seconds
✅ Error handling
✅ Health check endpoint
✅ Substitute teacher badges
✅ Student count display
✅ Nickname extraction
✅ Outside-hours handling

## Testing

### Test Database Connection
```bash
curl http://localhost:5557/api/health
```

Expected response:
```json
{
  "status": "ok",
  "service": "Where Is My Room - ICAN Academy",
  "database": "Connected to scheduling_db",
  "timestamp": "2025-10-30T..."
}
```

### Test Current Time Slot
```bash
curl http://localhost:5557/api/current-timeslot
```

### Test Room Assignments
```bash
curl http://localhost:5557/api/room-assignments
```

## Maintenance

### No Maintenance Required on Scheduling App
- ✅ Scheduling app continues to operate normally
- ✅ No changes needed to scheduling app code
- ✅ No changes needed to scheduling app database
- ✅ Both apps can run independently

### Database Schema Changes
If scheduling app database schema changes:
1. Update queries in `server/server.js`
2. Test with `curl` commands
3. Verify UI still displays correctly

## Performance

### Database Load
- One query per page load
- Query runs every 10 seconds per client
- Uses indexed columns (date, time_slot_id, is_active)
- JOIN operations optimized with proper indexes

### Recommended Setup
- Maximum 5-10 concurrent TV displays
- Each display = 6 queries/minute
- Database handles this easily

## Security

### Network Security
- Server binds to localhost only (not exposed to internet)
- CORS enabled for local development
- No authentication required (internal network only)

### Database Security
- Uses same credentials as scheduling app
- Read-only queries only
- No SQL injection vulnerabilities (parameterized queries)

## Future Enhancements

Potential features (not implemented):
- [ ] Search bar to find specific teacher/student
- [ ] Display all time slots in tabs
- [ ] Show upcoming classes
- [ ] QR code for each room assignment
- [ ] Color-coding by subject or level
- [ ] Teacher photos
- [ ] Room photos
- [ ] Floor plan with room locations

---

**Document Version**: 1.0
**Last Updated**: October 30, 2025
**Integration Status**: ✅ Complete and Working
