import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import pool from './db.js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5557;

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from client directory
app.use(express.static(path.join(__dirname, '../client')));

// Gallery list endpoint - supports both images and videos
app.get('/gallery-list', (req, res) => {
  const galleryPath = path.join(__dirname, '../client/gallery');

  try {
    // Check if gallery folder exists
    if (!fs.existsSync(galleryPath)) {
      return res.json([]);
    }

    // Read all files in the gallery folder
    const files = fs.readdirSync(galleryPath);

    // Filter for image and video files
    const mediaFiles = files.filter(file => {
      const ext = path.extname(file).toLowerCase();
      return ['.jpg', '.jpeg', '.png', '.gif', '.mp4', '.webm', '.mov'].includes(ext);
    }).map(file => {
      const ext = path.extname(file).toLowerCase();
      const isVideo = ['.mp4', '.webm', '.mov'].includes(ext);
      return {
        filename: file,
        type: isVideo ? 'video' : 'image'
      };
    });

    res.json(mediaFiles);
  } catch (error) {
    console.error('Error reading gallery folder:', error);
    res.status(500).json({ error: 'Failed to read gallery folder' });
  }
});

// Helper function to get current time slot
function getCurrentTimeSlot() {
  const now = new Date();
  const hour = now.getHours();

  // Map current time to time slot ID based on database structure:
  // Slot 1 = 8-9 AM (hour 8)
  // Slot 2 = 9-10 AM (hour 9)
  // Slot 3 = 10-11 AM (hour 10)
  // Slot 4 = 11-12 PM (hour 11)
  // Slot 5 = 1-2 PM (hour 13)
  // Slot 6 = 2-3 PM (hour 14)
  // Slot 7 = 3-4 PM (hour 15)
  // Slot 8 = 4-5 PM (hour 16)
  // Slot 9 = 5-6 PM (hour 17)
  // Slot 10 = 6-7 PM (hour 18)
  // Slot 11 = 7-8 PM (hour 19)
  // Slot 12 = 8-9 PM (hour 20)

  if (hour >= 8 && hour < 12) {
    return hour - 7; // 8am = slot 1, 9am = slot 2, 10am = slot 3, 11am = slot 4
  } else if (hour >= 13 && hour < 21) {
    return hour - 8; // 13 (1pm) = slot 5, 14 (2pm) = slot 6, 15 (3pm) = slot 7, etc.
  }

  return null; // Outside of class hours (12 PM lunch or after 9 PM)
}

// Helper function to get today's date in local timezone
function getTodayDate() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

// API Routes

// Weather endpoint - Fetch real weather from wttr.in (no API key needed!)
app.get('/api/weather', async (req, res) => {
  try {
    // Use wttr.in - free weather service, no API key required
    // Default location: Seoul, South Korea
    const location = process.env.WEATHER_LOCATION || 'Seoul';
    const weatherUrl = `https://wttr.in/${encodeURIComponent(location)}?format=j1`;

    const response = await fetch(weatherUrl);
    const data = await response.json();

    const current = data.current_condition[0];
    const tempC = parseInt(current.temp_C);
    const weatherDesc = current.weatherDesc[0].value;
    const weatherCode = parseInt(current.weatherCode);
    const uvIndex = parseInt(current.uvIndex) || 0;

    // Map weather codes to emoji
    // Based on wttr.in weather codes
    let icon = '⛅';
    if (weatherCode === 113) icon = '☀️'; // Sunny
    else if (weatherCode === 116) icon = '⛅'; // Partly cloudy
    else if (weatherCode === 119 || weatherCode === 122) icon = '☁️'; // Cloudy/Overcast
    else if (weatherCode === 143 || weatherCode === 248 || weatherCode === 260) icon = '🌫️'; // Fog/Mist
    else if (weatherCode >= 176 && weatherCode <= 299) icon = '🌧️'; // Rain
    else if (weatherCode >= 302 && weatherCode <= 359) icon = '🌧️'; // Heavy rain
    else if (weatherCode >= 362 && weatherCode <= 374) icon = '🌨️'; // Sleet
    else if (weatherCode >= 377 && weatherCode <= 395) icon = '❄️'; // Snow
    else if (weatherCode >= 200 && weatherCode <= 232) icon = '⛈️'; // Thunder

    res.json({
      temp: tempC,
      description: weatherDesc,
      icon: icon,
      uvIndex: uvIndex,
      simulated: false,
      location: location
    });
  } catch (error) {
    console.error('Error fetching weather:', error);
    // Fallback to simulated weather on error
    const hour = new Date().getHours();
    let uvIndex = 0;
    if (hour >= 6 && hour < 9) uvIndex = 3;
    else if (hour >= 9 && hour < 11) uvIndex = 6;
    else if (hour >= 11 && hour < 14) uvIndex = 9;
    else if (hour >= 14 && hour < 16) uvIndex = 7;
    else if (hour >= 16 && hour < 18) uvIndex = 4;
    else uvIndex = 1;

    res.json({
      temp: 28,
      description: 'Partly Cloudy',
      icon: '⛅',
      uvIndex: uvIndex,
      simulated: true,
      error: error.message
    });
  }
});

// Health check
app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT NOW()');
    res.json({
      status: 'ok',
      service: 'Where Is My Room - ICAN Academy',
      database: 'Connected to scheduling_db',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      status: 'error',
      service: 'Where Is My Room - ICAN Academy',
      database: 'Connection failed',
      error: error.message
    });
  }
});

// Get all rooms
app.get('/api/rooms', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM rooms ORDER BY display_order'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching rooms:', error);
    res.status(500).json({ error: 'Failed to fetch rooms' });
  }
});

// Get all time slots
app.get('/api/timeslots', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM time_slots ORDER BY display_order'
    );
    res.json(result.rows);
  } catch (error) {
    console.error('Error fetching time slots:', error);
    res.status(500).json({ error: 'Failed to fetch time slots' });
  }
});

// Get current time slot info
app.get('/api/current-timeslot', (req, res) => {
  const timeSlotId = getCurrentTimeSlot();
  const now = new Date();

  res.json({
    timeSlotId,
    currentTime: now.toLocaleTimeString(),
    currentHour: now.getHours(),
    inClassHours: timeSlotId !== null
  });
});

// Get room assignments for a specific date and time slot
app.get('/api/room-assignments', async (req, res) => {
  try {
    let date = req.query.date || getTodayDate();
    const timeSlotId = req.query.timeSlotId || getCurrentTimeSlot();
    let usedFallback = false;

    if (!timeSlotId) {
      return res.json({
        message: 'No classes at this time',
        assignments: [],
        date,
        timeSlotId: null,
        usedFallback: false
      });
    }

    // First, try to get assignments for today
    let result = await pool.query(
      `SELECT
         a.id,
         a.date,
         a.time_slot_id,
         a.room_id,
         a.notes,
         a.assignment_type,
         r.name as room_name,
         r.display_order,
         ts.name as time_slot_name,
         ts.start_time,
         ts.end_time,
         COALESCE(json_agg(DISTINCT jsonb_build_object(
           'id', t.id,
           'name', t.name,
           'color_keyword', t.color_keyword,
           'is_substitute', at.is_substitute
         )) FILTER (WHERE t.id IS NOT NULL), '[]'::json) as teachers,
         COALESCE(json_agg(DISTINCT jsonb_build_object(
           'id', s.id,
           'name', s.name,
           'english_name', s.english_name,
           'color_keyword', s.color_keyword,
           'weakness_level', s.weakness_level,
           'days_absent', COALESCE(s.days_absent, '[]'::jsonb)
         )) FILTER (WHERE s.id IS NOT NULL), '[]'::json) as students
       FROM assignments a
       INNER JOIN rooms r ON a.room_id = r.id
       INNER JOIN time_slots ts ON a.time_slot_id = ts.id
       LEFT JOIN assignment_teachers at ON a.id = at.assignment_id
       LEFT JOIN teachers t ON at.teacher_id = t.id
       LEFT JOIN assignment_students ast ON a.id = ast.assignment_id
       LEFT JOIN students s ON ast.student_id = s.id
       WHERE a.date::date = $1::date AND a.time_slot_id = $2 AND a.is_active = true
       GROUP BY a.id, a.assignment_type, r.name, r.display_order, ts.name, ts.start_time, ts.end_time
       ORDER BY r.display_order`,
      [date, timeSlotId]
    );

    // If no assignments found for today, fall back to most recent date with data
    if (result.rows.length === 0) {
      console.log(`No assignments for ${date}, checking for most recent date...`);

      // Find the most recent date with assignments for this time slot
      const recentDateResult = await pool.query(
        `SELECT date::date as date
         FROM assignments
         WHERE time_slot_id = $1 AND is_active = true AND date::date <= $2::date
         ORDER BY date::date DESC
         LIMIT 1`,
        [timeSlotId, date]
      );

      if (recentDateResult.rows.length > 0) {
        const recentDate = recentDateResult.rows[0].date;
        console.log(`Found recent date with data: ${recentDate}`);

        // Query again with the recent date
        result = await pool.query(
          `SELECT
             a.id,
             a.date,
             a.time_slot_id,
             a.room_id,
             a.notes,
             a.assignment_type,
             r.name as room_name,
             r.display_order,
             ts.name as time_slot_name,
             ts.start_time,
             ts.end_time,
             COALESCE(json_agg(DISTINCT jsonb_build_object(
               'id', t.id,
               'name', t.name,
               'color_keyword', t.color_keyword,
               'is_substitute', at.is_substitute
             )) FILTER (WHERE t.id IS NOT NULL), '[]'::json) as teachers,
             COALESCE(json_agg(DISTINCT jsonb_build_object(
               'id', s.id,
               'name', s.name,
               'english_name', s.english_name,
               'color_keyword', s.color_keyword,
               'weakness_level', s.weakness_level
             )) FILTER (WHERE s.id IS NOT NULL), '[]'::json) as students
           FROM assignments a
           INNER JOIN rooms r ON a.room_id = r.id
           INNER JOIN time_slots ts ON a.time_slot_id = ts.id
           LEFT JOIN assignment_teachers at ON a.id = at.assignment_id
           LEFT JOIN teachers t ON at.teacher_id = t.id
           LEFT JOIN assignment_students ast ON a.id = ast.assignment_id
           LEFT JOIN students s ON ast.student_id = s.id
           WHERE a.date::date = $1::date AND a.time_slot_id = $2 AND a.is_active = true
           GROUP BY a.id, a.assignment_type, r.name, r.display_order, ts.name, ts.start_time, ts.end_time
           ORDER BY r.display_order`,
          [recentDate, timeSlotId]
        );

        date = recentDate;
        usedFallback = true;
      }
    }

    res.json({
      date,
      requestedDate: req.query.date || getTodayDate(),
      timeSlotId,
      timeSlotName: result.rows[0]?.time_slot_name || null,
      assignments: result.rows,
      usedFallback
    });
  } catch (error) {
    console.error('Error fetching room assignments:', error);
    res.status(500).json({ error: 'Failed to fetch room assignments' });
  }
});

// Get all assignments for today (all time slots)
app.get('/api/today-schedule', async (req, res) => {
  try {
    const date = req.query.date || getTodayDate();

    const result = await pool.query(
      `SELECT
         a.id,
         a.date,
         a.time_slot_id,
         a.room_id,
         a.notes,
         a.assignment_type,
         r.name as room_name,
         r.display_order,
         ts.name as time_slot_name,
         ts.start_time,
         ts.end_time,
         ts.display_order as time_slot_order,
         COALESCE(json_agg(DISTINCT jsonb_build_object(
           'id', t.id,
           'name', t.name,
           'color_keyword', t.color_keyword,
           'is_substitute', at.is_substitute
         )) FILTER (WHERE t.id IS NOT NULL), '[]'::json) as teachers,
         COALESCE(json_agg(DISTINCT jsonb_build_object(
           'id', s.id,
           'name', s.name,
           'english_name', s.english_name,
           'color_keyword', s.color_keyword,
           'weakness_level', s.weakness_level,
           'days_absent', COALESCE(s.days_absent, '[]'::jsonb)
         )) FILTER (WHERE s.id IS NOT NULL), '[]'::json) as students
       FROM assignments a
       INNER JOIN rooms r ON a.room_id = r.id
       INNER JOIN time_slots ts ON a.time_slot_id = ts.id
       LEFT JOIN assignment_teachers at ON a.id = at.assignment_id
       LEFT JOIN teachers t ON at.teacher_id = t.id
       LEFT JOIN assignment_students ast ON a.id = ast.assignment_id
       LEFT JOIN students s ON ast.student_id = s.id
       WHERE a.date::date = $1::date AND a.is_active = true
       GROUP BY a.id, a.assignment_type, r.name, r.display_order, ts.name, ts.start_time, ts.end_time, ts.display_order
       ORDER BY ts.display_order, r.display_order`,
      [date]
    );

    res.json({
      date,
      totalAssignments: result.rows.length,
      assignments: result.rows
    });
  } catch (error) {
    console.error('Error fetching today schedule:', error);
    res.status(500).json({ error: 'Failed to fetch today schedule' });
  }
});

// Search for a teacher or student by name
app.get('/api/search', async (req, res) => {
  try {
    const searchTerm = req.query.q;
    const date = req.query.date || getTodayDate();

    if (!searchTerm) {
      return res.status(400).json({ error: 'Search term required' });
    }

    const result = await pool.query(
      `SELECT
         a.id,
         a.date,
         a.time_slot_id,
         a.room_id,
         r.name as room_name,
         ts.name as time_slot_name,
         ts.start_time,
         ts.end_time,
         COALESCE(json_agg(DISTINCT jsonb_build_object(
           'id', t.id,
           'name', t.name,
           'is_substitute', at.is_substitute
         )) FILTER (WHERE t.id IS NOT NULL), '[]'::json) as teachers,
         COALESCE(json_agg(DISTINCT jsonb_build_object(
           'id', s.id,
           'name', s.name,
           'english_name', s.english_name
         )) FILTER (WHERE s.id IS NOT NULL), '[]'::json) as students
       FROM assignments a
       INNER JOIN rooms r ON a.room_id = r.id
       INNER JOIN time_slots ts ON a.time_slot_id = ts.id
       LEFT JOIN assignment_teachers at ON a.id = at.assignment_id
       LEFT JOIN teachers t ON at.teacher_id = t.id
       LEFT JOIN assignment_students ast ON a.id = ast.assignment_id
       LEFT JOIN students s ON ast.student_id = s.id
       WHERE a.date::date = $1::date AND a.is_active = true
       AND (
         t.name ILIKE $2 OR
         s.name ILIKE $2 OR
         s.english_name ILIKE $2
       )
       GROUP BY a.id, r.name, ts.name, ts.start_time, ts.end_time
       ORDER BY ts.start_time, r.display_order`,
      [date, `%${searchTerm}%`]
    );

    res.json({
      searchTerm,
      date,
      results: result.rows
    });
  } catch (error) {
    console.error('Error searching:', error);
    res.status(500).json({ error: 'Search failed' });
  }
});

// Get all active teachers for a date with their availability
app.get('/api/all-teachers', async (req, res) => {
  try {
    const date = req.query.date || getTodayDate();

    const result = await pool.query(
      `SELECT id, name, availability
       FROM teachers
       WHERE date::date = $1::date AND is_active = true
       ORDER BY name`,
      [date]
    );

    res.json({
      date,
      teachers: result.rows
    });
  } catch (error) {
    console.error('Error fetching all teachers:', error);
    res.status(500).json({ error: 'Failed to fetch teachers' });
  }
});

// Start server on all network interfaces (0.0.0.0)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Where Is My Room Server running on port ${PORT}`);
  console.log(`📊 Local: http://localhost:${PORT}`);
  console.log(`🌐 Network: http://<YOUR-IP>:${PORT}`);
  console.log(`🏫 Reading from scheduling_db (read-only)`);
  console.log(`🔗 Health: http://localhost:${PORT}/api/health`);
});
