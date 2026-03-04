// Configuration - Automatically use current host
const isProxied = window.location.hostname.includes('icanacademy.work') || window.location.hostname.includes('ngrok');
const API_BASE_URL = isProxied
  ? `${window.location.protocol}//${window.location.hostname}/api`
  : `http://${window.location.hostname}:5557/api`;
const TEACHER_ATTENDANCE_API_URL = isProxied
  ? `${window.location.protocol}//teachattendance.icanacademy.work/api`
  : `http://${window.location.hostname}:3001/api`;
const STUDENT_ATTENDANCE_API_URL = isProxied
  ? `${window.location.protocol}//studentattendance.icanacademy.work/api`
  : `http://${window.location.hostname}:3002/api`;
const REFRESH_INTERVAL = 30000; // 30 seconds
const DISPLAY_ROTATION_INTERVAL = 3 * 60 * 1000; // 3 minutes

// Time slot mapping: attendance checker (2-hour) → scheduling DB (1-hour slot IDs)
const SCHEDULE_SLOT_TO_ATTENDANCE_SLOT = {
  1: '8am - 10am', 2: '8am - 10am',
  3: '10am - 12pm', 4: '10am - 12pm',
  5: '1pm - 3pm', 6: '1pm - 3pm',
  7: '3pm - 5pm', 8: '3pm - 5pm',
  9: '5pm - 7pm', 10: '5pm - 7pm',
  11: '7pm - 9pm', 12: '7pm - 9pm'
};

// State
let selectedDate = getTodayDateString();
let currentDisplayMode = 'rooms'; // 'rooms' or 'substitutes'
let substituteData = null;
let hasSubstitutesToday = false;
let teacherAttendanceMap = {}; // lowercase nickname → attendance record
let studentAbsentSet = new Set(); // Set of lowercase student names absent today
let allTeachersToday = []; // All active teachers for today with availability

// Get today's date as string (YYYY-MM-DD)
function getTodayDateString() {
  return new Date().toISOString().split('T')[0];
}

// Initialize the app
async function init() {
  console.log('🚀 Where Is My Room starting...');

  // Update clock
  updateClock();
  setInterval(updateClock, 1000);

  // Initial data load
  await loadRoomData();

  // Set up auto-refresh
  setInterval(loadRoomData, REFRESH_INTERVAL);

  console.log('✅ App initialized - auto-refreshing every', REFRESH_INTERVAL / 1000, 'seconds');
}

// Korean Holidays 2025
const koreanHolidays = {
  '2025-01-01': '🇰🇷 New Year\'s Day (Seollal)',
  '2025-01-28': '🇰🇷 Lunar New Year\'s Day',
  '2025-01-29': '🇰🇷 Lunar New Year',
  '2025-01-30': '🇰🇷 Lunar New Year',
  '2025-03-01': '🇰🇷 Independence Movement Day',
  '2025-05-05': '🇰🇷 Children\'s Day',
  '2025-05-06': '🇰🇷 Buddha\'s Birthday',
  '2025-06-06': '🇰🇷 Memorial Day',
  '2025-08-15': '🇰🇷 Liberation Day',
  '2025-09-28': '🇰🇷 Chuseok (Korean Thanksgiving)',
  '2025-09-29': '🇰🇷 Chuseok',
  '2025-09-30': '🇰🇷 Chuseok',
  '2025-10-03': '🇰🇷 National Foundation Day',
  '2025-10-09': '🇰🇷 Hangeul Day',
  '2025-12-25': '🇰🇷 Christmas Day'
};

// Philippine Holidays 2025
const philippineHolidays = {
  '2025-01-01': '🇵🇭 New Year\'s Day',
  '2025-02-25': '🇵🇭 EDSA People Power Revolution',
  '2025-04-09': '🇵🇭 Araw ng Kagitingan (Day of Valor)',
  '2025-04-17': '🇵🇭 Maundy Thursday',
  '2025-04-18': '🇵🇭 Good Friday',
  '2025-04-19': '🇵🇭 Black Saturday',
  '2025-05-01': '🇵🇭 Labor Day',
  '2025-06-12': '🇵🇭 Independence Day',
  '2025-08-21': '🇵🇭 Ninoy Aquino Day',
  '2025-08-25': '🇵🇭 National Heroes Day',
  '2025-10-31': '🇵🇭 All Saints\' Day Eve (Halloween)',
  '2025-11-01': '🇵🇭 All Saints\' Day',
  '2025-11-02': '🇵🇭 All Souls\' Day',
  '2025-11-30': '🇵🇭 Bonifacio Day',
  '2025-12-08': '🇵🇭 Feast of the Immaculate Conception',
  '2025-12-24': '🇵🇭 Christmas Eve',
  '2025-12-25': '🇵🇭 Christmas Day',
  '2025-12-26': '🇵🇭 Boxing Day',
  '2025-12-30': '🇵🇭 Rizal Day',
  '2025-12-31': '🇵🇭 New Year\'s Eve'
};

// Daily Inspirational Quotes - Teaching, Professionalism & Workplace Values
const dailyQuotes = [
  'Great teachers empathize with kids, respect them, and believe that each one has something special. - Ann Lieberman',
  'Professionalism is knowing how to do it, when to do it, and doing it. - Frank Tyger',
  'Focus on your own growth and let others do the same. - Unknown',
  'Your words have power. Use them to lift others up, not tear them down. - Unknown',
  'Integrity is doing the right thing, even when no one is watching. - C.S. Lewis',
  'Teaching is not about answering questions but about raising questions. - Unknown',
  'In a workplace, kindness and respect create the strongest teams. - Unknown',
  'The best teachers are those who show you where to look, but don\'t tell you what to see. - Alexandra Trenfor',
  'Surround yourself with positive people who inspire you to be better. - Albert Einstein',
  'Professionalism is not just about skills, but also about attitude and respect. - Unknown',
  'Speak with kindness, for your words reflect who you are. - Unknown',
  'A true friend supports you and celebrates your success. - Unknown',
  'Excellence is not a skill, it\'s an attitude of professionalism. - Ralph Marston',
  'Before you speak, let your words pass through three gates: Is it true? Is it necessary? Is it kind? - Rumi',
  'The quality of a teacher cannot be measured by test scores, but by hearts touched. - Unknown',
  'Workplace harmony comes from mutual respect and understanding. - Unknown',
  'Your character is defined by what you do when you think no one is looking. - Unknown',
  'Teaching kids to count is fine, but teaching them what counts is best. - Bob Talbert',
  'Be so focused on your own journey that you inspire others with your dedication. - Unknown',
  'Professionalism: It\'s NOT the job you DO, it\'s HOW you DO the job. - Unknown'
];

// Update clock display with holiday detection
function updateClock() {
  const now = new Date();

  // Format date
  const dateOptions = {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  };
  const dateStr = now.toLocaleDateString('en-US', dateOptions);

  // Format time
  const widgetTimeStr = now.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  document.getElementById('widgetTime').textContent = widgetTimeStr;
  document.getElementById('widgetDate').textContent = dateStr;

  // Update holiday line
  updateHolidayLine(now);
}

// Check and display holidays
function updateHolidayLine(date) {
  const dateStr = date.toISOString().split('T')[0];
  const holidayElement = document.getElementById('holidayLine');

  const koreanHoliday = koreanHolidays[dateStr];
  const philippineHoliday = philippineHolidays[dateStr];

  let holidayText = '';

  if (koreanHoliday && philippineHoliday) {
    holidayText = `${koreanHoliday} • ${philippineHoliday}`;
  } else if (koreanHoliday) {
    holidayText = koreanHoliday;
  } else if (philippineHoliday) {
    holidayText = philippineHoliday;
  } else {
    holidayText = '📅 Regular day';
  }

  holidayElement.textContent = holidayText;
}

// Update daily inspirational quote
function updateDailyQuote() {
  const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
  const quote = dailyQuotes[dayOfYear % dailyQuotes.length];

  document.getElementById('dailyQuote').textContent = quote;
}

// State for room assignments
let currentAssignments = [];
let currentTimeSlot = null;
let timeSlots = [];

// Load room data from API
async function loadRoomData() {
  try {
    console.log('📍 Loading room data...');

    // Fetch time slots from database
    const timeSlotsResponse = await fetch(`${API_BASE_URL}/timeslots`);
    timeSlots = await timeSlotsResponse.json();

    // Fetch current time slot
    const timeSlotResponse = await fetch(`${API_BASE_URL}/current-timeslot`);
    const timeSlotData = await timeSlotResponse.json();
    currentTimeSlot = timeSlotData;

    // Fetch ALL assignments for today (all time slots)
    const assignmentsResponse = await fetch(`${API_BASE_URL}/today-schedule`);
    const assignmentsData = await assignmentsResponse.json();
    currentAssignments = assignmentsData;

    // Fetch all active teachers for today
    const teachersResponse = await fetch(`${API_BASE_URL}/all-teachers`);
    const teachersData = await teachersResponse.json();
    allTeachersToday = teachersData.teachers || [];

    // Update UI - only update room display if we're in room mode
    if (currentDisplayMode === 'rooms') {
      updateRoomDisplay();
    }
    updateLastUpdateTime();
  } catch (error) {
    console.error('❌ Error loading room data:', error);
  }
}

// Update last update timestamp
function updateLastUpdateTime() {
  const now = new Date();
  const timeStr = now.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });
  document.getElementById('lastUpdate').textContent = `Last updated: ${timeStr}`;
}

// Fetch weather data from API
async function fetchWeather() {
  try {
    const response = await fetch(`${API_BASE_URL}/weather`);
    const weatherData = await response.json();

    updateWeatherDisplay({
      temp: weatherData.temp,
      description: weatherData.description.charAt(0).toUpperCase() + weatherData.description.slice(1),
      icon: weatherData.icon,
      uvIndex: weatherData.uvIndex
    });

    if (weatherData.simulated) {
      console.log('⚠️ Using simulated weather data. Add OPENWEATHER_API_KEY to .env for real weather.');
    } else {
      console.log('✅ Real weather data loaded');
    }
  } catch (error) {
    console.error('Error fetching weather:', error);
    // Fallback to default values on error
    updateWeatherDisplay({
      temp: 28,
      description: 'Partly Cloudy',
      icon: '⛅',
      uvIndex: 5
    });
  }
}

function getUVStatus(uvIndex) {
  if (uvIndex <= 2) {
    return { text: 'Low', class: 'low' };
  } else if (uvIndex <= 5) {
    return { text: 'Moderate', class: 'moderate' };
  } else if (uvIndex <= 7) {
    return { text: 'High', class: 'high' };
  } else if (uvIndex <= 10) {
    return { text: 'Very High', class: 'very-high' };
  } else {
    return { text: 'Extreme', class: 'extreme' };
  }
}

function updateWeatherDisplay(weather) {
  document.getElementById('weatherIcon').textContent = weather.icon;
  document.getElementById('weatherTemp').textContent = `${weather.temp}°C`;
  document.getElementById('weatherDesc').textContent = weather.description;

  const uvStatus = getUVStatus(weather.uvIndex);
  document.getElementById('uvIndex').textContent = weather.uvIndex;

  const uvStatusElement = document.getElementById('uvStatus');
  uvStatusElement.textContent = uvStatus.text;
  uvStatusElement.className = `uv-status ${uvStatus.class}`;
}

// Fetch word of the day
async function fetchWordOfDay() {
  try {
    const words = [
      { word: 'Navigate', pos: 'verb', meaning: 'To plan and direct the route or course of a journey.' },
      { word: 'Discovery', pos: 'noun', meaning: 'The action of finding or learning something for the first time.' },
      { word: 'Location', pos: 'noun', meaning: 'A particular place or position.' },
      { word: 'Journey', pos: 'noun', meaning: 'An act of traveling from one place to another.' },
      { word: 'Direction', pos: 'noun', meaning: 'A course along which someone or something moves.' }
    ];

    const dayOfYear = Math.floor((new Date() - new Date(new Date().getFullYear(), 0, 0)) / 86400000);
    const word = words[dayOfYear % words.length];

    updateWordDisplay(word);
  } catch (error) {
    console.error('Error updating word of day:', error);
  }
}

function updateWordDisplay(word) {
  document.getElementById('wordOfDay').textContent = word.word;
  document.getElementById('wordPos').textContent = word.pos;
  document.getElementById('wordMeaning').textContent = word.meaning;
}

// Generate smart mascot message - Classroom Reminders
function updateMascotMessage() {
  const messages = [
    '📝 Remember to send your report daily!',
    '⏰ Don\'t be late to class!',
    '📚 Bring all your materials today!',
    '🤫 Keep your classroom quiet!',
    '✋ Raise your hand before speaking!',
    '🧹 Clean up after yourself!',
    '💪 Do your homework on time!',
    '🎒 Organize your backpack daily!',
    '👂 Listen carefully to your teacher!',
    '🤝 Respect your classmates!',
    '📱 No phones during class!',
    '✏️ Take good notes every day!',
    '🚶 Walk, don\'t run in hallways!',
    '💧 Stay hydrated - drink water!',
    '😊 Be kind and helpful!',
    '🎯 Focus on your studies!',
    '📖 Read instructions carefully!',
    '🙋 Ask questions if you don\'t understand!',
    '⭐ Always do your best!',
    '🙏 Treat everyone with kindness and respect!'
  ];

  const randomMessage = messages[Math.floor(Math.random() * messages.length)];
  document.getElementById('mascotMessage').textContent = randomMessage;
}

// Photo & Video Gallery
let galleryMedia = [];
let currentMediaIndex = 0;

let galleryMediaTimeout = null; // Changed from interval to timeout for dynamic timing

async function loadGalleryImages() {
  try {
    console.log('🔄 Loading gallery media...');
    // Fetch list of media files (images and videos) from the gallery folder with cache-busting
    const response = await fetch(`/gallery-list?t=${Date.now()}`);
    console.log('Gallery API response status:', response.status);

    if (response.ok) {
      const newMedia = await response.json();

      // Check if the media list has changed
      const hasChanged = JSON.stringify(newMedia) !== JSON.stringify(galleryMedia);

      if (hasChanged) {
        console.log(`🆕 Gallery updated: ${galleryMedia.length} → ${newMedia.length} items`);
        galleryMedia = newMedia;

        // Cancel any existing timeout
        if (galleryMediaTimeout) {
          clearTimeout(galleryMediaTimeout);
          galleryMediaTimeout = null;
        }

        // Reset to first item if list changed
        if (galleryMedia.length > 0) {
          showGalleryMedia(0);
        }
      } else {
        console.log(`✅ Gallery unchanged: ${galleryMedia.length} items`);
      }

      if (galleryMedia.length === 0) {
        console.log('⚠️ No media found in gallery folder');
      }
    } else {
      console.error('❌ Gallery API returned error:', response.status);
    }
  } catch (error) {
    console.error('❌ Error loading gallery media:', error);
  }
}

function showGalleryMedia(index) {
  if (galleryMedia.length === 0) {
    console.log('⚠️ No media to show');
    return;
  }

  const imageElement = document.getElementById('galleryImage');
  const videoElement = document.getElementById('galleryVideo');

  if (!imageElement || !videoElement) {
    console.error('❌ Gallery elements not found!');
    return;
  }

  // Clear any existing timeout
  if (galleryMediaTimeout) {
    clearTimeout(galleryMediaTimeout);
  }

  currentMediaIndex = index % galleryMedia.length;
  const mediaItem = galleryMedia[currentMediaIndex];

  // URL-encode the filename to handle spaces and special characters
  const encodedFilename = encodeURIComponent(mediaItem.filename);
  const mediaUrl = `/gallery/${encodedFilename}`;

  console.log(`📸 Loading ${mediaItem.type} ${currentMediaIndex + 1}/${galleryMedia.length}: ${mediaItem.filename}`);

  // Fade out both elements
  imageElement.style.opacity = '0';
  videoElement.style.opacity = '0';

  setTimeout(() => {
    if (mediaItem.type === 'video') {
      // Hide image, show video
      imageElement.style.display = 'none';
      videoElement.style.display = 'block';
      videoElement.removeAttribute('loop'); // Remove loop so video plays once
      videoElement.src = mediaUrl;
      videoElement.load();

      // When video metadata loads, we can get its duration
      videoElement.addEventListener('loadedmetadata', function onMetadataLoaded() {
        const videoDuration = videoElement.duration;
        console.log(`✅ Video loaded - Duration: ${videoDuration.toFixed(1)}s`);

        // Schedule next media after video finishes (add 500ms buffer)
        const displayTime = (videoDuration * 1000) + 500;
        galleryMediaTimeout = setTimeout(nextGalleryMedia, displayTime);

        // Remove this event listener after it fires once
        videoElement.removeEventListener('loadedmetadata', onMetadataLoaded);
      });

      videoElement.play();
      videoElement.style.opacity = '1';
      console.log(`✅ Video displayed`);
    } else {
      // Hide video, show image
      videoElement.style.display = 'none';
      videoElement.pause();
      imageElement.style.display = 'block';
      imageElement.src = mediaUrl;
      imageElement.style.opacity = '1';
      console.log(`✅ Image displayed`);

      // Images display for 5 seconds
      galleryMediaTimeout = setTimeout(nextGalleryMedia, 5000);
    }
  }, 250);
}

function nextGalleryMedia() {
  showGalleryMedia(currentMediaIndex + 1);
}

// Initialize widgets
async function initWidgets() {
  try {
    await fetchWeather();
    await fetchWordOfDay();
    updateMascotMessage();
    updateDailyQuote();
    await loadGalleryImages();

    setInterval(fetchWeather, 30 * 60 * 1000);
    setInterval(fetchWordOfDay, 60 * 60 * 1000);
    setInterval(updateMascotMessage, 5 * 60 * 1000);
    setInterval(updateDailyQuote, 60 * 60 * 1000);
    // Reload gallery list every 5 minutes to detect new photos
    setInterval(loadGalleryImages, 5 * 60 * 1000);

    console.log('✅ Widgets initialized');
  } catch (error) {
    console.error('❌ Error initializing widgets:', error);
  }
}

// Fullscreen functionality
function toggleFullscreen() {
  if (!document.fullscreenElement &&
      !document.webkitFullscreenElement &&
      !document.mozFullScreenElement) {
    const elem = document.documentElement;
    if (elem.requestFullscreen) {
      elem.requestFullscreen();
    } else if (elem.webkitRequestFullscreen) {
      elem.webkitRequestFullscreen();
    } else if (elem.mozRequestFullScreen) {
      elem.mozRequestFullScreen();
    }
    console.log('✅ Entering fullscreen mode');
  } else {
    if (document.exitFullscreen) {
      document.exitFullscreen();
    } else if (document.webkitExitFullscreen) {
      document.webkitExitFullscreen();
    } else if (document.mozCancelFullScreen) {
      document.mozCancelFullScreen();
    }
    console.log('✅ Exiting fullscreen mode');
  }
}

// Initialize fullscreen controls
function initFullscreenControls() {
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  if (fullscreenBtn) {
    fullscreenBtn.addEventListener('click', toggleFullscreen);
    console.log('✅ Fullscreen button initialized');
  }

  document.addEventListener('keydown', (e) => {
    if (e.key === 'f' || e.key === 'F') {
      e.preventDefault();
      toggleFullscreen();
    }
  });

  document.addEventListener('fullscreenchange', updateFullscreenButton);
  document.addEventListener('webkitfullscreenchange', updateFullscreenButton);
  document.addEventListener('mozfullscreenchange', updateFullscreenButton);
}

function updateFullscreenButton() {
  const fullscreenBtn = document.getElementById('fullscreenBtn');
  if (!fullscreenBtn) return;

  const isFullscreen = document.fullscreenElement ||
                       document.webkitFullscreenElement ||
                       document.mozFullScreenElement;

  if (isFullscreen) {
    fullscreenBtn.textContent = '⛶';
    fullscreenBtn.title = 'Exit Fullscreen (F)';
  } else {
    fullscreenBtn.textContent = '⛶';
    fullscreenBtn.title = 'Enter Fullscreen (F)';
  }
}

// Extract romanized Korean name from formats like "Jeon Ye Won (Solar) [전예원]" -> "Jeon Ye Won"
function extractNickname(name) {
  // Remove content in parentheses (English names)
  let cleaned = name.replace(/\s*\([^)]+\)/g, '');

  // Remove content in brackets (Hangul Korean)
  cleaned = cleaned.replace(/\s*\[[^\]]+\]/g, '');

  // Remove any remaining Hangul characters
  cleaned = cleaned.replace(/[\uAC00-\uD7AF]/g, '');

  // Clean up extra spaces
  cleaned = cleaned.replace(/\s+/g, ' ').trim();

  return cleaned || name; // Fallback to original name if everything was removed
}

// Compare two arrays of assignments for equality
function arraysEqual(arr1, arr2) {
  if (arr1.length !== arr2.length) return false;

  // Sort both arrays by room_id for comparison
  const sorted1 = [...arr1].sort((a, b) => a.room_id - b.room_id);
  const sorted2 = [...arr2].sort((a, b) => a.room_id - b.room_id);

  for (let i = 0; i < sorted1.length; i++) {
    const a1 = sorted1[i];
    const a2 = sorted2[i];

    // Compare room
    if (a1.room_id !== a2.room_id) return false;

    // Compare teachers
    const t1 = a1.teachers.filter(t => t.id).sort((a, b) => a.id - b.id);
    const t2 = a2.teachers.filter(t => t.id).sort((a, b) => a.id - b.id);
    if (t1.length !== t2.length) return false;
    for (let j = 0; j < t1.length; j++) {
      if (t1[j].id !== t2[j].id || t1[j].is_substitute !== t2[j].is_substitute) return false;
    }

    // Compare students
    const s1 = a1.students.filter(s => s.id).sort((a, b) => a.id - b.id);
    const s2 = a2.students.filter(s => s.id).sort((a, b) => a.id - b.id);
    if (s1.length !== s2.length) return false;
    for (let j = 0; j < s1.length; j++) {
      if (s1[j].id !== s2[j].id) return false;
    }
  }

  return true;
}

// Update room display with current assignments
function updateRoomDisplay() {
  const container = document.querySelector('.room-finder-content');
  if (!container) return;

  // If no assignments at all
  if (!currentAssignments.assignments || currentAssignments.assignments.length === 0) {
    container.innerHTML = `
      <div class="placeholder-container">
        <div class="placeholder-icon">📭</div>
        <h3 class="placeholder-title">No Schedule Available</h3>
        <p class="placeholder-description">
          No classes scheduled for today
        </p>
      </div>
    `;
    return;
  }

  // Group assignments by time slot
  const assignmentsByTimeSlot = {};
  timeSlots.forEach(slot => {
    assignmentsByTimeSlot[slot.id] = [];
  });

  currentAssignments.assignments.forEach(assignment => {
    const slotId = assignment.time_slot_id;
    if (assignmentsByTimeSlot[slotId]) {
      assignmentsByTimeSlot[slotId].push(assignment);
    }
  });

  // Get current time slot for highlighting
  const currentSlotId = currentTimeSlot?.timeSlotId;

  console.log('🔄 Starting room-level time slot merging...');

  // Helper function to compare two room assignments
  function roomAssignmentsEqual(a1, a2) {
    if (!a1 || !a2) return false;
    if (a1.room_id !== a2.room_id) return false;

    // Compare teachers
    const t1 = a1.teachers.filter(t => t.id).sort((a, b) => a.id - b.id);
    const t2 = a2.teachers.filter(t => t.id).sort((a, b) => a.id - b.id);
    if (t1.length !== t2.length) return false;
    for (let j = 0; j < t1.length; j++) {
      if (t1[j].id !== t2[j].id || t1[j].is_substitute !== t2[j].is_substitute) return false;
    }

    // Compare students
    const s1 = a1.students.filter(s => s.id).sort((a, b) => a.id - b.id);
    const s2 = a2.students.filter(s => s.id).sort((a, b) => a.id - b.id);
    if (s1.length !== s2.length) return false;
    for (let j = 0; j < s1.length; j++) {
      if (s1[j].id !== s2[j].id) return false;
    }

    return true;
  }

  // Build room-level merging: for each room, find consecutive time slots where it has the same assignment
  const roomMergedData = {}; // { room_id: [{ timeSlots: [1,2], assignment: {...} }, ...] }

  // First, organize all assignments by room
  const assignmentsByRoom = {};
  timeSlots.forEach(slot => {
    const assignments = assignmentsByTimeSlot[slot.id] || [];
    assignments.forEach(assignment => {
      const roomId = assignment.room_id;
      if (!assignmentsByRoom[roomId]) {
        assignmentsByRoom[roomId] = [];
      }
      assignmentsByRoom[roomId].push({
        timeSlotId: slot.id,
        timeSlot: slot,
        assignment: assignment
      });
    });
  });

  // For each room, merge consecutive time slots with identical assignments
  Object.keys(assignmentsByRoom).forEach(roomId => {
    const roomSchedule = assignmentsByRoom[roomId].sort((a, b) => a.timeSlotId - b.timeSlotId);
    const merged = [];
    let i = 0;

    while (i < roomSchedule.length) {
      const current = roomSchedule[i];
      let endIndex = i;

      // Find consecutive slots with same assignment
      while (endIndex + 1 < roomSchedule.length) {
        const next = roomSchedule[endIndex + 1];

        // Check if time slots are consecutive and assignments are identical
        if (next.timeSlotId === roomSchedule[endIndex].timeSlotId + 1 &&
            roomAssignmentsEqual(current.assignment, next.assignment)) {
          endIndex++;
        } else {
          break;
        }
      }

      merged.push({
        startSlot: current.timeSlot,
        endSlot: roomSchedule[endIndex].timeSlot,
        slotIds: roomSchedule.slice(i, endIndex + 1).map(s => s.timeSlotId),
        assignment: current.assignment,
        isMerged: i !== endIndex
      });

      i = endIndex + 1;
    }

    roomMergedData[roomId] = merged;
  });

  // Now organize by unique time slot ranges for display
  // Group all rooms by their time range (e.g., "1-2-3" for slots 1,2,3)
  const roomsByTimeRange = {};

  Object.keys(roomMergedData).forEach(roomId => {
    const roomMerges = roomMergedData[roomId];

    roomMerges.forEach(merge => {
      const rangeKey = merge.slotIds.join('-');

      if (!roomsByTimeRange[rangeKey]) {
        roomsByTimeRange[rangeKey] = {
          startSlot: merge.startSlot,
          endSlot: merge.endSlot,
          slotIds: merge.slotIds,
          isMerged: merge.isMerged,
          rooms: []
        };
      }

      roomsByTimeRange[rangeKey].rooms.push(merge);
    });
  });

  console.log(`📊 Created ${Object.keys(roomsByTimeRange).length} unique time ranges with room-level merging`);

  // NEW LOGIC:
  // Show all classes that START within the next 3 hours from now
  // Example: If it's 6:00 AM, show classes starting between 6:00 AM and 9:00 AM
  const now = new Date();
  const currentHour = now.getHours();
  const currentMinute = now.getMinutes();

  // Calculate current time as decimal (e.g., 7:30 AM = 7.5)
  const currentTimeDecimal = currentHour + (currentMinute / 60);

  // Calculate 3 hours from now
  const threeHoursLater = currentTimeDecimal + 3;

  console.log(`⏰ Current time: ${currentHour}:${currentMinute.toString().padStart(2, '0')} (${currentTimeDecimal.toFixed(2)})`);
  console.log(`📅 Showing classes starting until: ${threeHoursLater.toFixed(2)}`);

  // Helper function to extract hour from time slot name
  function extractHourFromSlot(slotName, isEnd = false) {
    let hourMatch;
    if (isEnd) {
      hourMatch = slotName.match(/to (\d+)(AM|PM)/);
    } else {
      hourMatch = slotName.match(/(\d+)(AM|PM)/);
    }

    if (!hourMatch) return null;

    let hour = parseInt(hourMatch[1]);
    const period = hourMatch[2];

    if (period === 'PM' && hour !== 12) hour += 12;
    if (period === 'AM' && hour === 12) hour = 0;

    return hour;
  }

  // Filter ranges to show: all classes starting within the next 3 hours
  const displayRanges = [];

  Object.values(roomsByTimeRange).forEach(range => {
    const startHour = extractHourFromSlot(range.startSlot.name, false);
    const endHour = extractHourFromSlot(range.endSlot.name, true);

    if (startHour === null || endHour === null) return;

    // Check if class starts within the next 3 hours window
    // Include classes that:
    // 1. Are currently ongoing (started at or before current hour, ends after current hour)
    // 2. Start within the next 3 hours from current time

    // A class is ongoing if we're currently in the middle of it
    const isOngoing = startHour <= currentHour && currentHour < endHour;

    // A class starts within window if its start time is:
    // - At or after the current time (using decimal for precision)
    // - Before 3 hours from now
    const startsWithinWindow = startHour >= currentTimeDecimal && startHour < threeHoursLater;

    if (isOngoing || startsWithinWindow) {
      displayRanges.push({ ...range, startHour, endHour, isOngoing });
    }
  });

  // Sort filtered ranges by start time
  displayRanges.sort((a, b) => a.slotIds[0] - b.slotIds[0]);

  const ongoingCount = displayRanges.filter(r => r.isOngoing).length;
  const upcomingCount = displayRanges.filter(r => !r.isOngoing).length;

  console.log(`📊 Total displayed: ${displayRanges.length} ranges (${ongoingCount} ongoing + ${upcomingCount} upcoming within 3 hours)`);

  const filteredRanges = displayRanges;

  // Build lookup: which teachers are subbing elsewhere in each attendance slot
  // Key: "attendanceSlot|lowercaseNickname" → true
  const teachersSubbingElsewhere = new Set();
  Object.values(teacherAttendanceMap).forEach(record => {
    (record.allClassAssignments || []).forEach(ca => {
      if (ca.substitute_teacher_name && !(ca.no_class || ca.noClass)) {
        const subNickname = extractTeacherNickname(ca.substitute_teacher_name).toLowerCase();
        const slot = ca.class_slot || ca.classSlot;
        teachersSubbingElsewhere.add(`${slot}|${subNickname}`);
      }
    });
  });

  if (teachersSubbingElsewhere.size > 0) {
    console.log(`📋 Teachers subbing elsewhere:`, [...teachersSubbingElsewhere]);
  }

  let html = `
    <div class="full-day-schedule">
  `;

  // Display each filtered time range ONCE
  filteredRanges.forEach(range => {
    const isCurrent = range.slotIds.some(id => id === currentSlotId);
    const isOngoing = range.isOngoing; // Use the isOngoing flag we added

    // Format time slot name - Full readable format: "4PM to 7PM"
    let timeLabel;
    if (range.isMerged) {
      // Merged: "8AM to 9AM" + "10AM to 11AM" = "8AM to 11AM"
      const startMatch = range.startSlot.name.match(/(\d+)(AM|PM)/);
      const endMatch = range.endSlot.name.match(/to (\d+)(AM|PM)/);
      timeLabel = `${startMatch[1]}${startMatch[2]} to ${endMatch[1]}${endMatch[2]}`;
    } else {
      // Single: "8AM to 9AM" = "8AM to 9AM"
      timeLabel = range.startSlot.name;
    }

    // Add status badge
    const statusBadge = isOngoing ? '<span class="status-badge ongoing">ONGOING</span>' : '<span class="status-badge upcoming">UPCOMING</span>';

    // Compute available (unassigned) teachers for this time slot range
    // 1. Teachers available for ALL slots in this range
    const availableForSlots = allTeachersToday.filter(t => {
      const avail = t.availability || [];
      return range.slotIds.every(slotId => avail.includes(slotId));
    });

    // 2. Teachers assigned to ANY room in ANY of this range's slots
    //    BUT exclude teachers whose rooms are effectively VACANT (all students absent)
    const todayDayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
    const assignedTeacherNames = new Set();
    range.slotIds.forEach(slotId => {
      const slotAssignments = assignmentsByTimeSlot[slotId] || [];
      slotAssignments.forEach(assignment => {
        // Check if this assignment has students remaining after absence filtering
        const assignmentType = assignment.assignment_type || 'class';
        const isOnlineOrTask = assignmentType === 'online' || assignmentType === 'task';
        const allStudents = (assignment.students || []).filter(s => s.id !== null);
        const remainingStudents = allStudents.filter(s => {
          if ((s.days_absent || []).includes(todayDayName)) return false;
          if (studentAbsentSet.has(s.name.toLowerCase().trim())) return false;
          return true;
        });
        const isVacantRoom = remainingStudents.length === 0 && !isOnlineOrTask;

        (assignment.teachers || []).forEach(t => {
          if (t.id && !isVacantRoom) {
            assignedTeacherNames.add(t.name.toLowerCase().trim());
          }
        });
      });
    });

    // 3. Teachers absent/late (from attendance map)
    // 4. Teachers subbing elsewhere (from teachersSubbingElsewhere set)
    const unassignedTeachers = availableForSlots.filter(t => {
      const name = t.name.toLowerCase().trim();
      // Skip if assigned to a room
      if (assignedTeacherNames.has(name)) return false;
      // Skip if absent or late
      if (teacherAttendanceMap[name]) {
        const status = teacherAttendanceMap[name].status;
        if (status === 'absent') return false;
      }
      // Skip if subbing elsewhere in this slot
      const attendanceSlot = SCHEDULE_SLOT_TO_ATTENDANCE_SLOT[range.slotIds[0]];
      if (attendanceSlot && teachersSubbingElsewhere.has(`${attendanceSlot}|${name}`)) return false;
      return true;
    });

    const availableHtml = unassignedTeachers.length > 0
      ? `<span class="available-teachers">Available: ${unassignedTeachers.map(t => 'T. ' + t.name).join(', ')}</span>`
      : '';

    html += `
      <div class="timeslot-row ${isCurrent ? 'current-slot' : ''} ${isOngoing ? 'ongoing' : 'upcoming'}">
        <div class="timeslot-header">
          <span class="timeslot-time">${timeLabel}</span>
          ${statusBadge}
          ${availableHtml}
          <span class="timeslot-count">${range.rooms.length} rooms</span>
        </div>
        <div class="timeslot-rooms">
    `;

    range.rooms.forEach(room => {
      const assignment = room.assignment;
      const teachers = assignment.teachers.filter(t => t.id !== null);
      const allStudents = assignment.students.filter(s => s.id !== null);

      // Filter out students who are absent today (recurring + one-off)
      const todayDayName = new Date().toLocaleDateString('en-US', { weekday: 'long' });
      const students = allStudents.filter(s => {
        // Recurring absence (from Notion days_absent)
        const daysAbsent = s.days_absent || [];
        if (daysAbsent.includes(todayDayName)) return false;
        // One-off absence (from student attendance checker)
        if (studentAbsentSet.has(s.name.toLowerCase().trim())) return false;
        return true;
      });

      // Check teacher attendance and find substitutes for this time slot
      const attendanceSlot = SCHEDULE_SLOT_TO_ATTENDANCE_SLOT[assignment.time_slot_id];
      let hasAbsentTeacher = false;
      let hasLateTeacher = false;
      let hasUndertimeTeacher = false;
      let substituteTeacherName = null;
      let slotIsNoClass = false;
      let absentTeacherNickname = '';

      teachers.forEach(t => {
        const nickname = extractNickname(t.name).toLowerCase();
        const record = teacherAttendanceMap[nickname];
        if (record) {
          absentTeacherNickname = extractNickname(t.name);

          // Find the class assignment for this specific time slot
          // Uses allClassAssignments which merges classAssignments + undertimeClassAssignments
          const classAssignment = (record.allClassAssignments || []).find(ca => {
            const slot = ca.class_slot || ca.classSlot;
            return slot === attendanceSlot;
          });

          if (classAssignment) {
            // Determine the type of absence for this slot
            if (classAssignment.assignment_type === 'undertime') {
              hasUndertimeTeacher = true;
            } else if (record.status === 'absent') {
              hasAbsentTeacher = true;
            } else if (record.status === 'late') {
              hasLateTeacher = true;
            }

            if (classAssignment.no_class || classAssignment.noClass) {
              slotIsNoClass = true;
            } else if (classAssignment.substitute_teacher_name) {
              substituteTeacherName = extractTeacherNickname(classAssignment.substitute_teacher_name);
            }
          } else if (record.status === 'absent') {
            // Teacher is absent but no specific class assignment for this slot
            hasAbsentTeacher = true;
          } else if (record.status === 'late') {
            hasLateTeacher = true;
          }
        }
      });

      // Check if the teacher is subbing elsewhere in this time slot
      let isSubbingElsewhere = false;
      teachers.forEach(t => {
        const nickname = extractNickname(t.name).toLowerCase();
        if (attendanceSlot && teachersSubbingElsewhere.has(`${attendanceSlot}|${nickname}`)) {
          isSubbingElsewhere = true;
          absentTeacherNickname = absentTeacherNickname || extractNickname(t.name);
        }
      });

      // Build teacher display
      let teacherBadge;
      const teacherUnavailable = hasAbsentTeacher || hasUndertimeTeacher || (hasLateTeacher && substituteTeacherName);
      if (teacherUnavailable && substituteTeacherName) {
        // Teacher absent/undertime/late with sub assigned → show sub with indicator
        teacherBadge = `<span class="sub-badge">T. ${substituteTeacherName}</span> <span class="sub-for">(sub for ${absentTeacherNickname})</span>`;
      } else if (hasAbsentTeacher && !substituteTeacherName) {
        // Teacher absent, no sub
        teacherBadge = `<span class="absent-badge">T. ${absentTeacherNickname}</span> <span class="absent-tag">ABSENT</span>`;
      } else if (hasUndertimeTeacher && !substituteTeacherName) {
        // Teacher undertime, no sub for this slot
        teacherBadge = `<span class="absent-badge">T. ${absentTeacherNickname}</span> <span class="absent-tag">LEFT EARLY</span>`;
      } else if (isSubbingElsewhere) {
        // Teacher is subbing in another room this slot
        const nickname = teachers.map(t => extractNickname(t.name)).join(', ');
        teacherBadge = `<span class="absent-badge">T. ${nickname}</span> <span class="sub-elsewhere-tag">SUBBING</span>`;
      } else {
        // Normal - teacher present and on time
        teacherBadge = teachers.map(t =>
          `T. ${extractNickname(t.name)}${t.is_substitute ? '*' : ''}`
        ).join(', ');
      }

      const assignmentType = assignment.assignment_type || 'class';
      const isOnline = assignmentType === 'online';
      const isTask = assignmentType === 'task';
      const isVacant = students.length === 0 && !isOnline && !isTask;

      // Determine card class
      let cardClass = 'compact-room-card';
      if (isOnline) cardClass += ' online';
      else if (isTask) cardClass += ' task';
      else if (teacherUnavailable && substituteTeacherName) cardClass += ' has-substitute';
      else if ((hasAbsentTeacher || hasUndertimeTeacher) && !substituteTeacherName) cardClass += ' teacher-absent';
      else if (isSubbingElsewhere) cardClass += ' vacant';
      else if (isVacant) cardClass += ' vacant';

      // Determine student area content with vacancy reason
      let studentContent;
      if (isOnline) {
        studentContent = '<span class="online-label">ONLINE</span>';
      } else if (isTask) {
        studentContent = '<span class="task-label">TASK</span>';
      } else if (isVacant) {
        // Determine the reason for vacancy — prioritize student-related reasons
        let vacantReason = '';
        if (allStudents.length > 0 && students.length === 0) {
          // Students were assigned but all got filtered out — figure out why
          const absentRecurring = allStudents.filter(s => (s.days_absent || []).includes(todayDayName));
          const absentToday = allStudents.filter(s => studentAbsentSet.has(s.name.toLowerCase().trim()));
          if (absentRecurring.length > 0 && absentToday.length > 0) {
            vacantReason = 'students absent';
          } else if (absentRecurring.length > 0) {
            vacantReason = 'no class today';
          } else if (absentToday.length > 0) {
            vacantReason = 'student absent today';
          } else {
            vacantReason = 'students absent';
          }
        } else if (allStudents.length === 0) {
          vacantReason = 'no students assigned';
        } else if (isSubbingElsewhere && students.length > 0) {
          // Teacher gone but students still here — they need coverage
          vacantReason = 'teacher subbing elsewhere';
        }
        const reasonText = vacantReason ? ` <span class="vacant-reason">(${vacantReason})</span>` : '';
        const busyClass = isSubbingElsewhere ? ' busy' : '';
        studentContent = `<span class="vacant-label${busyClass}">AVAILABLE</span>${reasonText}`;
      } else {
        studentContent = students.map(s => extractNickname(s.name)).join(', ');
      }

      html += `
        <div class="${cardClass}">
          <div class="room-header">
            <span class="room-num">R${assignment.room_name}</span>
            <span class="teacher-badge">${teacherBadge || 'No teacher'}</span>
          </div>
          <div class="students-compact">
            ${studentContent}
          </div>
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  });

  html += `
    </div>
  `;

  container.innerHTML = html;
}

// =====================================================
// SUBSTITUTE DISPLAY FUNCTIONALITY
// =====================================================

// Fetch teacher attendance data from attendance-checker API (port 3001)
async function fetchSubstituteData() {
  try {
    const today = getTodayDateString();
    console.log('📋 Fetching teacher attendance for:', today);

    const response = await fetch(`${TEACHER_ATTENDANCE_API_URL}/attendance/${today}`);

    if (!response.ok) {
      console.log('⚠️ No teacher attendance data available');
      substituteData = null;
      hasSubstitutesToday = false;
      teacherAttendanceMap = {};
      return;
    }

    const result = await response.json();
    const data = result.attendance || result;

    if (!Array.isArray(data)) {
      console.log('⚠️ Unexpected data format from teacher attendance API');
      substituteData = null;
      hasSubstitutesToday = false;
      teacherAttendanceMap = {};
      return;
    }

    // Build teacher attendance map: lowercase nickname → full record
    // Include absent, late, AND teachers with undertime (present but left early)
    teacherAttendanceMap = {};
    data.forEach(record => {
      const hasIssue = record.status === 'absent' || record.status === 'late' || record.has_undertime;
      if (hasIssue) {
        const nickname = extractTeacherNickname(record.teacher_name).toLowerCase();
        // Merge undertimeClassAssignments into classAssignments for unified lookup
        const allAssignments = [
          ...(record.classAssignments || []),
          ...(record.undertimeClassAssignments || [])
        ];
        teacherAttendanceMap[nickname] = { ...record, allClassAssignments: allAssignments };
      }
    });

    console.log(`📋 Teacher attendance map: ${Object.keys(teacherAttendanceMap).length} absent/late/undertime teachers`);
    Object.keys(teacherAttendanceMap).forEach(name => {
      const r = teacherAttendanceMap[name];
      const label = r.has_undertime ? `${r.status} + undertime` : r.status;
      console.log(`  ⚠️ ${name} → ${label}`);
    });

    // Filter for substitute display (absent/late with class assignments, OR undertime with assignments)
    const teachersWithSubs = data.filter(record =>
      ((record.status === 'absent' || record.status === 'late') &&
        record.classAssignments && record.classAssignments.length > 0) ||
      (record.has_undertime &&
        record.undertimeClassAssignments && record.undertimeClassAssignments.length > 0)
    );

    substituteData = teachersWithSubs;
    hasSubstitutesToday = teachersWithSubs.length > 0;

    console.log(`✅ Found ${teachersWithSubs.length} teachers with class assignments`);

    // Update room display if we're in rooms mode (to reflect attendance changes)
    if (currentDisplayMode === 'rooms') {
      updateRoomDisplay();
    }

  } catch (error) {
    console.error('❌ Error fetching teacher attendance:', error);
    substituteData = null;
    hasSubstitutesToday = false;
    teacherAttendanceMap = {};
  }
}

// Fetch student attendance data from student-attendance-checker API (port 3002)
async function fetchStudentAttendanceData() {
  try {
    const today = getTodayDateString();
    console.log('📋 Fetching student attendance for:', today);

    const response = await fetch(`${STUDENT_ATTENDANCE_API_URL}/attendance/${today}`);

    if (!response.ok) {
      console.log('⚠️ No student attendance data available');
      studentAbsentSet = new Set();
      return;
    }

    const result = await response.json();
    const data = result.attendance || result;

    if (!Array.isArray(data)) {
      console.log('⚠️ Unexpected data format from student attendance API');
      studentAbsentSet = new Set();
      return;
    }

    // Build set of absent student names (lowercase for matching)
    studentAbsentSet = new Set();
    data.forEach(record => {
      if (record.status === 'absent') {
        studentAbsentSet.add(record.student_name.toLowerCase().trim());
      }
    });

    console.log(`📋 Student absences today: ${studentAbsentSet.size} students`);
    studentAbsentSet.forEach(name => console.log(`  ❌ ${name}`));

    // Update room display if we're in rooms mode
    if (currentDisplayMode === 'rooms') {
      updateRoomDisplay();
    }

  } catch (error) {
    console.error('❌ Error fetching student attendance:', error);
    studentAbsentSet = new Set();
  }
}

// Extract nickname from teacher name format "[Nickname] Full Name"
function extractTeacherNickname(name) {
  if (!name) return 'Unknown';
  const match = name.match(/\[([^\]]+)\]/);
  return match ? match[1] : name.split(' ')[0];
}

// Render substitute display
function renderSubstituteDisplay() {
  const container = document.querySelector('.room-finder-content');
  console.log('🔄 renderSubstituteDisplay called, container:', container);
  console.log('📋 substituteData:', substituteData);

  if (!container) {
    console.log('❌ Container not found!');
    return;
  }

  // If no substitute data or empty
  if (!substituteData || substituteData.length === 0) {
    container.innerHTML = `
      <div class="placeholder-container">
        <div class="placeholder-icon">🎉</div>
        <h3 class="placeholder-title">All Teachers Present!</h3>
        <p class="placeholder-description">
          No substitutes needed today
        </p>
      </div>
    `;
    return;
  }

  // Group assignments by time slot, filtering out "no class" slots
  const slotOrder = ['8am - 10am', '10am - 12pm', '1pm - 3pm', '3pm - 5pm', '5pm - 7pm', '7pm - 9pm'];
  const assignmentsBySlot = {};

  // Initialize slots
  slotOrder.forEach(slot => {
    assignmentsBySlot[slot] = [];
  });

  // Organize data by slot - include both classAssignments and undertimeClassAssignments
  substituteData.forEach(teacher => {
    const allAssignments = [
      ...(teacher.classAssignments || []),
      ...(teacher.undertimeClassAssignments || [])
    ];
    allAssignments.forEach(assignment => {
      const slot = assignment.class_slot || assignment.classSlot;

      // Skip slots marked as "no class" - they don't need substitutes
      const isNoClass = assignment.no_class || assignment.noClass;
      if (isNoClass) return;

      // Skip slots without a substitute assigned
      const hasSubstitute = assignment.substitute_teacher_name && assignment.substitute_teacher_name.trim() !== '';
      if (!hasSubstitute) return;

      if (assignmentsBySlot[slot]) {
        // Handle students - could be array, JSON string, or undefined
        let students = [];
        if (Array.isArray(assignment.students)) {
          students = assignment.students;
        } else if (typeof assignment.students === 'string') {
          try {
            students = JSON.parse(assignment.students);
          } catch (e) {
            students = [];
          }
        }

        const statusLabel = assignment.assignment_type === 'undertime' ? 'undertime' : teacher.status;
        assignmentsBySlot[slot].push({
          teacherName: teacher.teacher_name,
          status: statusLabel,
          minutesLate: teacher.minutes_late,
          substituteTeacher: assignment.substitute_teacher_name,
          students: students,
          onlineClass: assignment.online_class || assignment.onlineClass,
          assignmentType: assignment.assignment_type
        });
      }
    });
  });

  // Count totals
  const absentCount = substituteData.filter(t => t.status === 'absent').length;
  const lateCount = substituteData.filter(t => t.status === 'late').length;
  let coveredCount = 0;
  let uncoveredCount = 0;

  Object.values(assignmentsBySlot).forEach(assignments => {
    assignments.forEach(a => {
      if (a.substituteTeacher || a.onlineClass) {
        coveredCount++;
      } else {
        uncoveredCount++;
      }
    });
  });

  // Check if there are any actual classes needing substitutes
  const totalAssignments = Object.values(assignmentsBySlot).reduce((sum, arr) => sum + arr.length, 0);
  console.log('📊 Total assignments with subs:', totalAssignments);

  if (totalAssignments === 0) {
    container.innerHTML = `
      <div class="placeholder-container">
        <div class="placeholder-icon">📭</div>
        <h3 class="placeholder-title">No Classes Need Coverage</h3>
        <p class="placeholder-description">
          ${absentCount + lateCount} teacher(s) absent/late but no classes scheduled
        </p>
      </div>
    `;
    return;
  }

  let html = `
    <div class="substitute-display">
      <div class="substitute-slots">
  `;

  // Render each time slot that has assignments
  slotOrder.forEach(slot => {
    const assignments = assignmentsBySlot[slot];
    if (assignments.length === 0) return;

    // Convert slot format for display (e.g., "8am - 10am" -> "8:00 AM - 10:00 AM")
    const slotDisplay = slot.replace(/(\d+)(am|pm)/gi, (match, num, period) => {
      return `${num}:00 ${period.toUpperCase()}`;
    });

    html += `
      <div class="substitute-slot">
        <div class="slot-header">
          <span class="slot-time">🕐 ${slotDisplay}</span>
          <span class="slot-count">${assignments.length} ${assignments.length === 1 ? 'class' : 'classes'}</span>
        </div>
        <div class="slot-assignments">
    `;

    assignments.forEach(assignment => {
      const teacherNick = extractTeacherNickname(assignment.teacherName);
      const subNick = extractTeacherNickname(assignment.substituteTeacher);
      const studentCount = Array.isArray(assignment.students) ? assignment.students.length : 0;

      // Determine status class (for border color)
      const statusClass = assignment.status === 'absent' ? 'absent' : 'late';

      // Format student names
      let studentNamesHtml = '';
      if (studentCount > 0) {
        const studentNames = assignment.students.map(s => {
          let name = s.name || s;
          if (typeof name === 'string') {
            name = name.replace(/\s*\[[^\]]*\]/g, '').trim();
            name = name.replace(/\s*\([^)]*\)/g, '').trim();
          }
          return name;
        }).join(', ');
        studentNamesHtml = `<div class="student-info">👥 ${studentNames}</div>`;
      }

      html += `
        <div class="substitute-card ${statusClass}">
          <div class="coverage-row">
            <span class="absent-teacher">❌ ${teacherNick}</span>
            <span class="arrow">→</span>
            <span class="sub-teacher">✅ ${subNick}</span>
          </div>
          ${studentNamesHtml}
        </div>
      `;
    });

    html += `
        </div>
      </div>
    `;
  });

  html += `
      </div>
      <div class="substitute-summary">
        <span class="summary-item absent">❌ Absent</span>
        <span class="summary-item late">⏰ Late</span>
        <span class="summary-item covered">✅ Covered</span>
      </div>
    </div>
  `;

  console.log('📝 Setting innerHTML, html length:', html.length);
  container.innerHTML = html;
  console.log('✅ innerHTML set, container children:', container.children.length);
}

// Toggle between room display and substitute display
function toggleDisplayMode(manual = false) {
  // Only auto-toggle if there are substitutes today (manual toggle always works)
  if (!manual && !hasSubstitutesToday) {
    console.log('📍 No substitutes today - staying on room display');
    currentDisplayMode = 'rooms';
    return;
  }

  currentDisplayMode = currentDisplayMode === 'rooms' ? 'substitutes' : 'rooms';
  console.log(`🔄 Switching display to: ${currentDisplayMode}`);

  updateMainDisplay();
  updateToggleButton();
}

// Update the toggle button appearance based on current mode
function updateToggleButton() {
  const btn = document.getElementById('displayToggleBtn');
  if (!btn) return;

  const icon = btn.querySelector('.toggle-icon');
  const text = btn.querySelector('.toggle-text');

  if (currentDisplayMode === 'substitutes') {
    btn.classList.add('showing-substitutes');
    icon.textContent = '🏫';
    text.textContent = 'Rooms';
    btn.title = 'Switch to Rooms (S)';
  } else {
    btn.classList.remove('showing-substitutes');
    icon.textContent = '📋';
    text.textContent = 'Substitutes';
    btn.title = 'Switch to Substitutes (S)';
  }
}

// Update the main display based on current mode
function updateMainDisplay() {
  const titleElement = document.querySelector('.category-title');

  if (currentDisplayMode === 'substitutes') {
    const dateStr = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
    if (titleElement) titleElement.textContent = `📋 TODAY'S SUBSTITUTES - ${dateStr}`;
    renderSubstituteDisplay();
  } else {
    if (titleElement) titleElement.textContent = '🏫 CLASSROOM LOCATOR';
    updateRoomDisplay();
  }
}

// Timer for display rotation
let displayRotationTimer = null;

// Reset and start the rotation timer
function resetDisplayRotationTimer() {
  if (displayRotationTimer) {
    clearInterval(displayRotationTimer);
  }
  displayRotationTimer = setInterval(() => toggleDisplayMode(false), DISPLAY_ROTATION_INTERVAL);
}

// Initialize display rotation
function initDisplayRotation() {
  // Fetch attendance data initially
  fetchSubstituteData();
  fetchStudentAttendanceData();

  // Refresh attendance data every 30 seconds (same as room data)
  setInterval(fetchSubstituteData, REFRESH_INTERVAL);
  setInterval(fetchStudentAttendanceData, REFRESH_INTERVAL);

  // No auto-rotation — classroom locator is always the default view
  // Substitute view is accessible via manual toggle only

  // Add click handler for toggle button
  const toggleBtn = document.getElementById('displayToggleBtn');
  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      toggleDisplayMode(true);
    });
    console.log('✅ Display toggle button initialized');
  }

  // Add keyboard shortcut (S key) for toggling
  document.addEventListener('keydown', (e) => {
    if (e.key === 's' || e.key === 'S') {
      e.preventDefault();
      toggleDisplayMode(true);
    }
  });

  console.log('✅ Classroom locator is default. Press S or click button to view substitutes.');
}

// =====================================================
// END SUBSTITUTE DISPLAY FUNCTIONALITY
// =====================================================

// Lunch Break Floating Food Emojis (11:50 AM - 12:50 PM)
function checkLunchTime() {
  const now = new Date();
  const hours = now.getHours();
  const minutes = now.getMinutes();

  // Check if it's lunch time: 11:50 AM to 12:50 PM
  const isLunchTime = (hours === 11 && minutes >= 50) || (hours === 12 && minutes < 50);

  const container = document.getElementById('lunchEmojis');

  if (isLunchTime && !container.classList.contains('active')) {
    console.log('🍱 Lunch time! Starting food emojis...');
    container.classList.add('active');
    startFoodEmojis();
  } else if (!isLunchTime && container.classList.contains('active')) {
    console.log('⏰ Lunch time ended. Stopping food emojis.');
    container.classList.remove('active');
    stopFoodEmojis();
  }
}

let foodEmojiInterval = null;

function startFoodEmojis() {
  const foodEmojis = [
    '🍕', '🍔', '🍟', '🌭', '🍿', '🥗', '🍝', '🍜', '🍲', '🍱',
    '🍙', '🍚', '🥟', '🍤', '🍣', '🥙', '🌮', '🌯', '🥪', '🍞',
    '🥐', '🥖', '🧀', '🥚', '🍳', '🥞', '🧇', '🥓', '🍗', '🍖',
    '🥩', '🌰', '🍛', '🍘', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧',
    '🧁', '🍰', '🎂', '🍮', '🍭', '🍬', '🍫', '🍩', '🍪', '🌰',
    '🥜', '🍯', '🥛', '🍼', '🧃', '🧋', '🍵', '☕', '🥤', '🧊',
    '🍇', '🍈', '🍉', '🍊', '🍋', '🍌', '🍍', '🥭', '🍎', '🍏',
    '🍐', '🍑', '🍒', '🍓', '🥝', '🍅', '🥥', '🥑', '🍆', '🥔',
    '🥕', '🌽', '🌶️', '🥒', '🥬', '🥦', '🧄', '🧅', '🍄', '🥕'
  ];

  const container = document.getElementById('lunchEmojis');

  // Create a new food emoji every 800ms
  foodEmojiInterval = setInterval(() => {
    const emoji = document.createElement('div');
    emoji.className = 'floating-food';
    emoji.textContent = foodEmojis[Math.floor(Math.random() * foodEmojis.length)];

    // Random horizontal position
    emoji.style.left = Math.random() * 100 + '%';

    // Random animation duration (15-25 seconds for slow fall)
    const duration = 15 + Math.random() * 10;
    emoji.style.animationDuration = duration + 's';

    // Random delay
    emoji.style.animationDelay = Math.random() * 2 + 's';

    container.appendChild(emoji);

    // Remove emoji after animation completes
    setTimeout(() => {
      if (emoji.parentNode) {
        emoji.remove();
      }
    }, (duration + 2) * 1000);
  }, 800);
}

function stopFoodEmojis() {
  if (foodEmojiInterval) {
    clearInterval(foodEmojiInterval);
    foodEmojiInterval = null;
  }

  // Clear all existing emojis
  const container = document.getElementById('lunchEmojis');
  container.innerHTML = '';
}

// Check lunch time every 10 seconds
setInterval(checkLunchTime, 10000);
// Check immediately on load
setTimeout(checkLunchTime, 1000);

// Start the app when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    init();
    initWidgets();
    initFullscreenControls();
    initDisplayRotation();
  });
} else {
  init();
  initWidgets();
  initFullscreenControls();
  initDisplayRotation();
}
