// Day theme templates based on Teaching Tekkers camp PDFs
// When a theme is selected, its content is suggested into the day fields
// Admin can still manually edit everything after selection

export interface ThemeTemplate {
  id: string;
  label: string;
  description: string;
  /** Suggested day title suffix, e.g. "Crazy Hair Day" */
  titleSuffix: string;
  /** Suggested setup notes */
  setupNotes: string;
  /** What to remind kids about for this theme (used as *this* day's theme points block) */
  themePointsBlock: string;
  /** Suggested clean-up/reminder text referencing next theme */
  cleanUpNote: string;
}

export const DAY_THEMES: ThemeTemplate[] = [
  {
    id: "none",
    label: "No Theme",
    description: "Standard camp day with no special theme",
    titleSuffix: "",
    setupNotes: "Arrive latest 9:30am. Session to be set up by 9:50am, players behind poles in teams.",
    themePointsBlock: "",
    cleanUpNote: "Ball Surfing.",
  },
  {
    id: "registration_day",
    label: "Registration Day (Day 1)",
    description: "First day – registration, introductions, team selection",
    titleSuffix: "",
    setupNotes: "The whole session set up at 9:45 while head coach finishes registration. Registration starts, parents pay, kids sit down behind sign with age group. If the kid is not on the sign in sheet, ensure their parents sign up online.",
    themePointsBlock: "",
    cleanUpNote: "Ball Surfing and Reminder to Kids about tomorrow's theme.",
  },
  {
    id: "crazy_hair",
    label: "Crazy Hair Day",
    description: "Kids come with crazy hairstyles – points for best hair",
    titleSuffix: "Crazy Hair Day",
    setupNotes: "Arrive latest 9:30am. Session to be set up by 9:50am, players behind poles in teams.",
    themePointsBlock: "Points for Crazy Hair Day",
    cleanUpNote: "Ball Surfing and Reminder to Kids about tomorrow's theme.",
  },
  {
    id: "face_paint",
    label: "Face Paint Day",
    description: "Kids come with face paint – points for best face paint",
    titleSuffix: "Face Paint Day",
    setupNotes: "Arrive latest 9:30am. Session to be set up by 9:50am, players behind poles in teams.",
    themePointsBlock: "Points for Face Paint Day",
    cleanUpNote: "Ball Surfing and Reminder to Kids about tomorrow's theme.",
  },
  {
    id: "dress_coaches",
    label: "Dress the Coaches Day",
    description: "Kids dress up the coaches – points for funniest outfit",
    titleSuffix: "Dress the Coaches",
    setupNotes: "Arrive latest 9:30am. Session to be set up by 9:50am, players behind poles in teams.",
    themePointsBlock: "Points for Dress the Coaches Day",
    cleanUpNote: "Ball Surfing and Reminder to Kids about tomorrow's theme.",
  },
  {
    id: "logo_day",
    label: "Logo Day",
    description: "Kids create/wear team logos – points for Biggest, Smallest, Most Creative",
    titleSuffix: "Logo Day",
    setupNotes: "Arrive latest 9:30am. Session to be set up by 9:50am, players behind poles in teams.",
    themePointsBlock: "Points for Logo Day – Points for Biggest, Smallest, Most Creative",
    cleanUpNote: "Ball Surfing and Reminder to Kids about tomorrow's theme.",
  },
  {
    id: "player_country",
    label: "Player from Country Day",
    description: "Kids dress as a player from any country",
    titleSuffix: "Player from Country Day",
    setupNotes: "Arrive latest 9:30am. Session to be set up by 9:50am, players behind poles in teams.",
    themePointsBlock: "Points for Player from Country Day",
    cleanUpNote: "Ball Surfing and Reminder to Kids about tomorrow's theme.",
  },
  {
    id: "flag_day",
    label: "Flag Day",
    description: "Kids bring/create flags – points for Biggest, Smallest, Most Creative",
    titleSuffix: "Flag Day",
    setupNotes: "Arrive latest 9:30am. Session to be set up by 9:50am, players behind poles in teams.",
    themePointsBlock: "Points for Flag Day – Biggest, Smallest, Most Creative",
    cleanUpNote: "Ball Surfing.",
  },
  {
    id: "halloween_costume",
    label: "Halloween Costume Day",
    description: "Kids come in Halloween costumes – points for best costume",
    titleSuffix: "Halloween Costume Day",
    setupNotes: "Arrive latest 9:30am. Session to be set up by 9:50am, players behind poles in teams.",
    themePointsBlock: "Points for Halloween Costume Day",
    cleanUpNote: "Ball Surfing and Trophies.",
  },
  {
    id: "final_day",
    label: "Final Day (Tournament)",
    description: "Last day of camp – knockout finals, trophies, and celebrations",
    titleSuffix: "Final Day",
    setupNotes: "Arrive latest 9:30am. Session to be set up by 9:50am, players behind poles in teams.",
    themePointsBlock: "",
    cleanUpNote: "Ball Surfing and Trophies.",
  },
];

/** Schedule block templates for different day types */
export interface BlockTemplate {
  start_time: string;
  end_time: string;
  block_title: string;
  description: string;
}

export const DAY1_BLOCKS: BlockTemplate[] = [
  { start_time: "09:45", end_time: "10:00", block_title: "Registration & Setup", description: "Session set up while head coach finishes registration. Registration starts, parents pay, kids sit down behind sign with age group." },
  { start_time: "10:00", end_time: "10:05", block_title: "Introduction", description: "Introduction of all coaches, reminder of no bullying and plan for the week. Kids sent off with coaches for morning technical session, suit to age group." },
  { start_time: "10:05", end_time: "11:30", block_title: "Morning Session", description: "Begin with fun games (Coach's Choice, can ask players what games they want to play – always start with penalties). Heaven or Hell Penalties. King of the Ring. 1vs1, 2vs2 – winner stays on. Numbers game with goalkeeper both sides." },
  { start_time: "11:30", end_time: "11:45", block_title: "Small Break", description: "Set up camp games and get a small break between this time." },
  { start_time: "11:45", end_time: "12:00", block_title: "Divide into Teams", description: "Decide how many teams based off numbers on the camp (Keep these teams for the week). Join groups together for camp games." },
  { start_time: "12:00", end_time: "12:50", block_title: "Camp Games", description: "Football Baseball. American Penalties – (points for winning team)." },
  { start_time: "12:50", end_time: "13:20", block_title: "Big Lunch", description: "Set up pitches for Matches." },
  { start_time: "13:20", end_time: "13:30", block_title: "Coaches Challenge", description: "Crossbar." },
  { start_time: "13:30", end_time: "14:45", block_title: "Matches on Fixture List", description: "" },
  { start_time: "14:45", end_time: "15:00", block_title: "Clean Up & Home Time", description: "" },
  { start_time: "15:00", end_time: "", block_title: "Home Time", description: "Make sure all kids are collected and footballs collected." },
];

export const DAY2_THEMED_BLOCKS: BlockTemplate[] = [
  { start_time: "10:05", end_time: "10:20", block_title: "Theme Points", description: "" },
  { start_time: "10:20", end_time: "11:30", block_title: "Morning Session", description: "Split into Age Groups: Smallest Kids Play Tournament/Fun Games, others play Fun Games (Coach's Choice). Head, Shoulders, Knees and Cones. X's and O's. Ball Mastery (maximum of 5 minutes). Cone Reaction Game. Last Man Standing. Heaven or Hell Crossbar Challenge." },
  { start_time: "11:30", end_time: "11:45", block_title: "Small Break", description: "Set up camp games and get a small break between this time. Join groups together for camp games." },
  { start_time: "11:45", end_time: "12:50", block_title: "Camp Games", description: "American Penalties. Capture the Balls (points for winning team)." },
  { start_time: "12:50", end_time: "13:20", block_title: "Big Lunch", description: "Set up pitches for Matches." },
  { start_time: "13:20", end_time: "13:30", block_title: "Coaches Challenge", description: "American Penalties." },
  { start_time: "13:30", end_time: "14:45", block_title: "Matches on Fixture List", description: "Bonus Points." },
  { start_time: "14:45", end_time: "15:00", block_title: "Clean Up & Home Time", description: "" },
  { start_time: "15:00", end_time: "", block_title: "Home Time", description: "Make sure all kids are collected and footballs collected." },
];

export const DAY3_THEMED_BLOCKS: BlockTemplate[] = [
  { start_time: "10:05", end_time: "10:20", block_title: "Theme Points", description: "" },
  { start_time: "10:20", end_time: "11:15", block_title: "Crossbar Challenge", description: "Crossbar Challenge in their teams – other games if needed." },
  { start_time: "11:15", end_time: "11:30", block_title: "Small Break", description: "Set up camp games and get a small break between this time. Join groups together for camp games." },
  { start_time: "11:30", end_time: "12:50", block_title: "Camp Games", description: "Links. Football Bulldog (points for winning team)." },
  { start_time: "12:50", end_time: "13:20", block_title: "Big Lunch", description: "Set up pitches." },
  { start_time: "13:20", end_time: "13:30", block_title: "Coaches Challenge", description: "Knock the Ball." },
  { start_time: "13:30", end_time: "14:45", block_title: "Matches – Wildcards", description: "Rest of Group Matches – Wildcards." },
  { start_time: "14:45", end_time: "15:00", block_title: "Clean Up & Home Time", description: "" },
  { start_time: "15:00", end_time: "", block_title: "Home Time", description: "Make sure all kids are collected and footballs collected." },
];

export const FINAL_DAY_BLOCKS: BlockTemplate[] = [
  { start_time: "10:05", end_time: "10:20", block_title: "Theme Points", description: "" },
  { start_time: "10:20", end_time: "11:15", block_title: "Penalties", description: "Penalties in their teams. Other games if needed." },
  { start_time: "11:15", end_time: "11:30", block_title: "Small Break", description: "Set up camp games and get a small break between this time." },
  { start_time: "11:30", end_time: "12:50", block_title: "Camp Games", description: "Join groups together for camp games – Football Olympics." },
  { start_time: "12:50", end_time: "13:20", block_title: "Big Lunch", description: "Set up pitches for Knockout's." },
  { start_time: "13:20", end_time: "13:30", block_title: "Coaches Challenge", description: "Head Coach Choice." },
  { start_time: "13:30", end_time: "14:45", block_title: "Finals", description: "" },
  { start_time: "14:45", end_time: "15:00", block_title: "Clean Up & Trophies", description: "Ball Surfing and Trophies." },
  { start_time: "15:00", end_time: "", block_title: "Home Time", description: "Make sure all kids are collected and additional footballs collected." },
];

/**
 * Get the suggested block templates for a given theme and day number.
 * Day 1 always uses DAY1 blocks. Themed days 2+ use themed blocks.
 * Final day uses FINAL_DAY_BLOCKS.
 */
export function getBlocksForTheme(themeId: string, dayNumber: number): BlockTemplate[] {
  if (themeId === "registration_day" || dayNumber === 1) return DAY1_BLOCKS;
  if (themeId === "final_day") return FINAL_DAY_BLOCKS;
  // Day 3 style (crossbar challenge, wildcards)
  if (dayNumber >= 3) return DAY3_THEMED_BLOCKS;
  // Day 2 style (themed morning session)
  return DAY2_THEMED_BLOCKS;
}
