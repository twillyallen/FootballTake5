// questions.js
// Exactly 5 questions per date. Each: { question, choices[4], answer(0..3), explanation? }
export const CALENDAR = {
  "2025-09-10": [
    { question: "Who won SB LVIII?", choices: ["Chiefs", "49ers", "Eagles", "Ravens"], answer: 0 },
    { question: "Lambeau Field team?", choices: ["Bears", "Packers", "Lions", "Vikings"], answer: 1 },
    { question: "Career pass TD leader?", choices: ["Brady", "Brees", "Manning", "Rodgers"], answer: 0 },
    { question: "J.J. Watt led which stat?", choices: ["INT", "Sacks", "Tackles", "PD"], answer: 1 },
    { question: "Ravens QB in 2024?", choices: ["Allen", "Mahomes", "Lamar", "Burrow"], answer: 2 }
  ],
  "2025-09-11": [
    { question: "Legion of Boom team?", choices: ["Broncos", "Seahawks", "Jets", "Giants"], answer: 1 },
    { question: "Frozen Tundra refers to?", choices: ["Soldier Field", "Lambeau Field", "Arrowhead", "MetLife"], answer: 1 },
    { question: "49ers HC (2024 season)?", choices: ["McVay", "Shanahan", "Harbaugh", "Campbell"], answer: 1 },
    { question: "Most SB wins (franchise)?", choices: ["Patriots", "Steelers", "Cowboys", "49ers"], answer: 0 },
    { question: "DPOY 2023?", choices: ["Bosa", "Watt", "Garrett", "Parsons"], answer: 2 }
  ],
  "2025-09-12": [
    { question: "Name one of the 3 players who are 6'5\" and ran a 4.3", choices: ["Davante Adams", "Donte Thornton", "Don Hutson", "Courtland Sutton"], answer: 1 },
    { question: "Who was called 'Mr Butt Fumble'?", choices: ["Kurt Warner", "Derek Carr", "Tim Tebow", "Mark Sanchez"], answer: 3 },
    { question: "How many teams has Peyton Manning played for?", choices: ["1", "3", "2", "1"], answer: 2 },
    { question: "Which team was Drew Brees drafted by?", choices: ["Chargers", "Saints", "Bengals", "49ers"], answer: 0 },
    { question: "DPOY 2023?", choices: ["Bosa", "Watt", "Garrett", "Parsons"], answer: 2 }
  ],
  "2025-09-13": [
    { question: "Name one of the 3 players who are 6'5\" and ran a 4.3", choices: ["Davante Adams", "Donte Thornton", "Don Hutson", "Courtland Sutton"], answer: 1 },
    { question: "Who was called 'Mr Butt Fumble'?", choices: ["Kurt Warner", "Derek Carr", "Tim Tebow", "Mark Sanchez"], answer: 3 },
    { question: "How many teams has Peyton Manning played for?", choices: ["1", "3", "2", "1"], answer: 2 },
    { question: "Which team was Drew Brees drafted by?", choices: ["Chargers", "Saints", "Bengals", "49ers"], answer: 0 },
    { question: "DPOY 2023?", choices: ["Bosa", "Watt", "Garrett", "Parsons"], answer: 2 }
  ]
};

// Optional fallback if you ever choose to use it
export const POOL = [
  { question: "Mile High team?", choices:["Broncos","Bills","Bears","Bengals"], answer:0 }
];
