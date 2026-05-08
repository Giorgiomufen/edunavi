/* class-data.js — eKool-style sample dataset for the Klass view.
 * 20 students × 5 fraction exercises in 8th grade.
 * Each cell is one of: "correct" | "partial" | "wrong" | "blank".
 * Numbers are realistic Estonian distributions: most kids do OK, a few struggle, a few ace.
 *
 * Real eKool integration replaces this file. The shape of each row stays the same.
 */
(function () {
  const EXERCISES = [
    { id: "ex-1", text: "Murdude liitmine ühise nimetajaga",     skill: "ühine nimetaja" },
    { id: "ex-2", text: "Murdude lahutamine erineva nimetajaga", skill: "ühine nimetaja" },
    { id: "ex-3", text: "Murdude korrutamine",                    skill: "korrutamine" },
    { id: "ex-4", text: "Murdude jagamine",                       skill: "pööratud murd" },
    { id: "ex-5", text: "Murdude lihtsustamine",                  skill: "tegurid" },
  ];

  const ROSTERS = [
    [
      // Roster A — typical mid-class spread
      { name: "Kerli Aas",        results: ["correct", "correct", "correct", "correct", "correct"] },
      { name: "Markus Saar",      results: ["correct", "correct", "correct", "partial", "correct"] },
      { name: "Liisa Tamm",       results: ["correct", "correct", "partial", "correct", "correct"] },
      { name: "Robin Lepik",      results: ["partial", "wrong",   "correct", "wrong",   "correct"] },
      { name: "Anette Mägi",      results: ["wrong",   "wrong",   "partial", "wrong",   "partial"] },
      { name: "Karl Kask",        results: ["correct", "partial", "correct", "correct", "partial"] },
      { name: "Mia Põder",        results: ["wrong",   "wrong",   "wrong",   "wrong",   "blank"  ] },
      { name: "Henri Jõgi",       results: ["correct", "correct", "correct", "correct", "partial"] },
      { name: "Sandra Soosaar",   results: ["partial", "partial", "correct", "partial", "correct"] },
      { name: "Joonas Org",       results: ["correct", "correct", "correct", "correct", "correct"] },
      { name: "Lisette Vaher",    results: ["wrong",   "wrong",   "wrong",   "blank",   "wrong"  ] },
      { name: "Roman Kruus",      results: ["correct", "partial", "wrong",   "correct", "wrong"  ] },
      { name: "Mariliis Ojala",   results: ["correct", "correct", "partial", "correct", "correct"] },
      { name: "Oliver Lill",      results: ["partial", "correct", "correct", "partial", "correct"] },
      { name: "Hanna Roosi",      results: ["wrong",   "partial", "wrong",   "wrong",   "partial"] },
      { name: "Mihkel Kuusik",    results: ["correct", "correct", "correct", "correct", "correct"] },
      { name: "Eliise Pärn",      results: ["correct", "wrong",   "correct", "wrong",   "correct"] },
      { name: "Rauno Toom",       results: ["partial", "wrong",   "partial", "wrong",   "wrong"  ] },
      { name: "Kerttu Sild",      results: ["correct", "correct", "correct", "partial", "correct"] },
      { name: "Tom Vään",         results: ["wrong",   "wrong",   "blank",   "wrong",   "wrong"  ] },
    ],
    [
      // Roster B — class is mostly stuck; teacher must repeat
      { name: "Annika Mets",      results: ["wrong",   "wrong",   "partial", "wrong",   "blank"  ] },
      { name: "Andres Kaljula",   results: ["partial", "wrong",   "wrong",   "blank",   "wrong"  ] },
      { name: "Birgit Kallas",    results: ["wrong",   "partial", "wrong",   "wrong",   "wrong"  ] },
      { name: "Mart Põllu",       results: ["correct", "wrong",   "wrong",   "wrong",   "partial"] },
      { name: "Helen Anton",      results: ["partial", "wrong",   "partial", "blank",   "wrong"  ] },
      { name: "Ats Karu",         results: ["wrong",   "wrong",   "wrong",   "wrong",   "wrong"  ] },
      { name: "Mihkel Maasik",    results: ["correct", "partial", "correct", "wrong",   "wrong"  ] },
      { name: "Kati Lillemäe",    results: ["wrong",   "blank",   "partial", "wrong",   "wrong"  ] },
      { name: "Toomas Kalda",     results: ["partial", "partial", "wrong",   "wrong",   "blank"  ] },
      { name: "Stella Roos",      results: ["correct", "correct", "partial", "correct", "correct"] },
      { name: "Erkki Sepp",       results: ["wrong",   "wrong",   "wrong",   "partial", "wrong"  ] },
      { name: "Janne Lind",       results: ["partial", "wrong",   "correct", "wrong",   "partial"] },
      { name: "Kristofer Pärn",   results: ["wrong",   "partial", "wrong",   "wrong",   "wrong"  ] },
      { name: "Triin Mägi",       results: ["correct", "wrong",   "wrong",   "blank",   "wrong"  ] },
      { name: "Sander Toots",     results: ["wrong",   "wrong",   "partial", "wrong",   "blank"  ] },
      { name: "Maarja Sild",      results: ["correct", "correct", "correct", "partial", "correct"] },
      { name: "Rasmus Kuusk",     results: ["partial", "wrong",   "wrong",   "wrong",   "wrong"  ] },
      { name: "Liis Veski",       results: ["wrong",   "partial", "blank",   "wrong",   "wrong"  ] },
      { name: "Aleks Vaher",      results: ["correct", "partial", "correct", "wrong",   "partial"] },
      { name: "Hanna-Liisa Tamm", results: ["wrong",   "wrong",   "wrong",   "wrong",   "wrong"  ] },
    ],
    [
      // Roster C — strong class; safe to move on
      { name: "Joosep Kärbe",     results: ["correct", "correct", "correct", "correct", "correct"] },
      { name: "Triinu Liiv",      results: ["correct", "correct", "partial", "correct", "correct"] },
      { name: "Marten Aav",       results: ["correct", "correct", "correct", "correct", "correct"] },
      { name: "Iris Rebane",      results: ["correct", "correct", "correct", "correct", "partial"] },
      { name: "Karl-Erik Saar",   results: ["correct", "partial", "correct", "correct", "correct"] },
      { name: "Lisete Kask",      results: ["correct", "correct", "correct", "correct", "correct"] },
      { name: "Hugo Põld",        results: ["correct", "correct", "correct", "partial", "correct"] },
      { name: "Hanna Tooming",    results: ["partial", "correct", "correct", "correct", "correct"] },
      { name: "Reimo Kaup",       results: ["correct", "correct", "correct", "correct", "correct"] },
      { name: "Liisbeth Tomberg", results: ["correct", "correct", "correct", "correct", "correct"] },
      { name: "Kaspar Vahtra",    results: ["correct", "correct", "partial", "correct", "correct"] },
      { name: "Anna Kullamaa",    results: ["correct", "correct", "correct", "correct", "correct"] },
      { name: "Robin Tomson",     results: ["correct", "correct", "correct", "correct", "correct"] },
      { name: "Saskia Kuusk",     results: ["correct", "correct", "partial", "correct", "correct"] },
      { name: "Jürgen Põllu",     results: ["correct", "correct", "correct", "correct", "correct"] },
      { name: "Mia Lepik",        results: ["correct", "correct", "correct", "correct", "correct"] },
      { name: "Andre Sõerd",      results: ["correct", "partial", "correct", "correct", "correct"] },
      { name: "Helena Veski",     results: ["correct", "correct", "correct", "correct", "correct"] },
      { name: "Karoliina Kade",   results: ["partial", "wrong",   "wrong",   "wrong",   "partial"] },
      { name: "Tarmo Kaur",       results: ["correct", "correct", "correct", "partial", "correct"] },
    ],
  ];

  window.EDUNAVI_CLASS_DATA = {
    EXERCISES,
    ROSTERS,
    META: {
      schoolName: "Tallinna 21. Kool",
      className: "8.A",
      topic: "Murdude põhitehted",
      lessonDate: new Date().toLocaleDateString("et-EE"),
    },
  };
})();
