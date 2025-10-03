function timeWord(timeStr) {
  //Parse the time string
  const [hourStr, minuteStr] = timeStr.split(":");
  const hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);

  //Handle special cases
  if (hour === 0 && minute === 0) return "midnight";
  if (hour === 12 && minute === 0) return "noon";

  //Number to word mappings
  const ones = [
    "",
    "one",
    "two",
    "three",
    "four",
    "five",
    "six",
    "seven",
    "eight",
    "nine",
    "ten",
    "eleven",
    "twelve",
    "thirteen",
    "fourteen",
    "fifteen",
    "sixteen",
    "seventeen",
    "eighteen",
    "nineteen"
  ];

  const tens = ["", "", "twenty", "thirty", "forty", "fifty"];

  // Convert hour to 12-hour format and determine AM/PM
  let displayHour = hour;
  let period = "am";

  if (hour === 0) {
    displayHour = 12;
  } else if (hour >= 12) {
    period = "pm";
    if (hour > 12) {
      displayHour = hour - 12;
    }
  }

  // Convert hour to words
  const hourWord = ones[displayHour];

  // Convert minutes to words
  let minuteWord = "";

  if (minute === 0) {
    minuteWord = "o'clock";
  } else if (minute < 10) {
    minuteWord = `oh ${ones[minute]}`;
  } else if (minute < 20) {
    minuteWord = ones[minute];
  } else {
    const tensDigit = Math.floor(minute / 10);
    const onesDigit = minute % 10;

    if (onesDigit === 0) {
      minuteWord = tens[tensDigit];
    } else {
      minuteWord = `${tens[tensDigit]} ${ones[onesDigit]}`;
    }
  }

  // Combine parts
  return `${hourWord} ${minuteWord} ${period}`;
}

module.exports = timeWord;
