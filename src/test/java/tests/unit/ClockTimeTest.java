package tests.unit;

import org.testng.annotations.Test;
import utils.ClockTime;

import static org.testng.Assert.assertEquals;
import static org.testng.Assert.assertFalse;
import static org.testng.Assert.assertThrows;
import static org.testng.Assert.assertTrue;

/** Omar 2026-10-30 (AI sessions 418-423, Availo shift times): the time a test asks for, read the way the clock dialog needs it. */
public class ClockTimeTest {

    @Test
    public void a24HourTimeGivesTheEveningHourAndPm() {
        ClockTime t = ClockTime.parse("18:00");
        assertEquals(t.hour24(), 18);
        assertEquals(t.minute(), 0);
        assertEquals(t.hour12(), 6);
        assertTrue(t.pm());
    }

    @Test
    public void a12HourTimeWithPmIsTheSameTime() {
        ClockTime t = ClockTime.parse("6:30 PM");
        assertEquals(t.hour24(), 18);
        assertEquals(t.minute(), 30);
    }

    @Test
    public void anHourAloneMeansOnTheHour() {
        ClockTime t = ClockTime.parse("6 pm");
        assertEquals(t.hour24(), 18);
        assertEquals(t.minute(), 0);
    }

    @Test
    public void midnightAndNoonAreTwelveOnTheClock() {
        ClockTime midnight = ClockTime.parse("00:00");
        assertEquals(midnight.hour12(), 12);
        assertFalse(midnight.pm());
        assertEquals(ClockTime.parse("12:00 am").hour24(), 0);
        ClockTime noon = ClockTime.parse("12:00");
        assertEquals(noon.hour12(), 12);
        assertTrue(noon.pm());
        assertEquals(ClockTime.parse("12:15 pm").hour24(), 12);
    }

    @Test
    public void arabicAmPmAndDigitsAreRead() {
        ClockTime t = ClockTime.parse("٦:٣٠ م"); // 6:30 PM in Arabic
        assertEquals(t.hour24(), 18);
        assertEquals(t.minute(), 30);
        assertEquals(ClockTime.parse("9:05 ص").hour24(), 9);
    }

    @Test
    public void theClockHeaderShowsTwoDigits() {
        ClockTime t = ClockTime.parse("09:05");
        assertEquals(t.hourHeader(), "09");
        assertEquals(t.minuteHeader(), "05");
        assertEquals(ClockTime.parse("00:00").hourHeader(), "12");
    }

    @Test
    public void aFieldValueMatchesWhenItIsTheSameTimeInAnyWriting() {
        ClockTime t = ClockTime.parse("17:00");
        assertTrue(t.matches("5:00 pm"));
        assertTrue(t.matches("17:00"));
        assertFalse(t.matches("5:00 am"));
        assertFalse(t.matches(""));
        assertFalse(t.matches(null));
        assertFalse(t.matches("not a time"));
    }

    @Test
    public void aWrongTimeIsRefusedInPlainWords() {
        for (String bad : new String[]{"25:00", "10:60", "13:00 pm", "0:00 am", "", "soon"}) {
            IllegalArgumentException e = expectThrows(bad);
            assertTrue(e.getMessage().contains("is not a time"), e.getMessage());
        }
        assertThrows(IllegalArgumentException.class, () -> ClockTime.parse(null));
    }

    @Test
    public void theFacePlaceOfTwelveIsTheTopAndThreeIsTheRight() {
        assertEquals(ClockTime.offset(12, 12, 100), new int[]{0, -100});
        assertEquals(ClockTime.offset(3, 12, 100), new int[]{100, 0});
        assertEquals(ClockTime.offset(30, 60, 100), new int[]{0, 100});
        assertEquals(ClockTime.offset(45, 60, 100), new int[]{-100, 0});
    }

    @Test
    public void onA24HourClockOnlyOneToTwelveSitOnTheOuterRing() {
        assertFalse(ClockTime.parse("10:00").innerRing24());
        assertFalse(ClockTime.parse("12:00").innerRing24());
        assertTrue(ClockTime.parse("18:00").innerRing24());
        assertTrue(ClockTime.parse("00:00").innerRing24());
    }

    private static IllegalArgumentException expectThrows(String bad) {
        try {
            ClockTime.parse(bad);
        } catch (IllegalArgumentException e) {
            return e;
        }
        throw new AssertionError("\"" + bad + "\" was taken as a time");
    }
}
