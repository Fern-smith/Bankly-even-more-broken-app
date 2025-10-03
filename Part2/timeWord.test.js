const timeWord = require("./timeWord");

describe("#timeword", () => {
  test("it is a function", () => {
    expect(typeof timeWord).toBe("function");
  });

  // Test midnight and noon special cases
  test("handles midnight", () => {
    expect(timeWord("00:00")).toBe("midnight");
  });

  test("handles noon", () => {
    expect(timeWord("12:00")).toBe("noon");
  });

  // Test AM times
  test("handles early morning times", () => {
    expect(timeWord("00:01")).toBe("twelve oh one am");
    expect(timeWord("00:30")).toBe("twelve thirty am");
    expect(timeWord("01:00")).toBe("one o'clock am");
    expect(timeWord("01:15")).toBe("one fifteen am");
  });

  test('handles single digit minutes with "oh"', () => {
    expect(timeWord("08:05")).toBe("eight oh five am");
    expect(timeWord("15:07")).toBe("three oh seven pm");
  });

  test("handles ten to nineteen minutes", () => {
    expect(timeWord("09:10")).toBe("nine ten am");
    expect(timeWord("14:11")).toBe("two eleven pm");
    expect(timeWord("07:19")).toBe("seven nineteen am");
  });

  test("handles twenty plus minutes", () => {
    expect(timeWord("10:25")).toBe("ten twenty five am");
    expect(timeWord("16:34")).toBe("four thirty four pm");
    expect(timeWord("22:47")).toBe("ten forty seven pm");
  });

  // Test PM times
  test("handles afternoon times", () => {
    expect(timeWord("13:00")).toBe("one o'clock pm");
    expect(timeWord("18:30")).toBe("six thirty pm");
    expect(timeWord("23:59")).toBe("eleven fifty nine pm");
  });

  // Test exact hours
  test("handles exact hours", () => {
    expect(timeWord("03:00")).toBe("three o'clock am");
    expect(timeWord("17:00")).toBe("five o'clock pm");
  });

  // Test edge cases
  test("handles various minute patterns", () => {
    expect(timeWord("11:20")).toBe("eleven twenty am");
    expect(timeWord("14:40")).toBe("two forty pm");
    expect(timeWord("06:55")).toBe("six fifty five am");
  });

  // Test all hours to ensure proper conversion
  test("handles all 24 hours correctly", () => {
    expect(timeWord("00:30")).toBe("twelve thirty am");
    expect(timeWord("12:30")).toBe("twelve thirty pm");
    expect(timeWord("01:30")).toBe("one thirty am");
    expect(timeWord("13:30")).toBe("one thirty pm");
    expect(timeWord("11:30")).toBe("eleven thirty am");
    expect(timeWord("23:30")).toBe("eleven thirty pm");
  });
});
