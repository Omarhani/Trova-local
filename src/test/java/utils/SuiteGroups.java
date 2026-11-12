package utils;

import org.testng.xml.XmlSuite;
import org.testng.xml.XmlTest;

/**
 * Omar 2026-10-25 (online run 16: a web suite started the phone set-up and every test was skipped): does this suite
 * need the phone? Yes when the suite or one of its blocks includes the Mob (or Hybrid) group, or when no block names
 * any group at all (an older suite - everything runs as before). A suite whose blocks name only Web is web only.
 */
public final class SuiteGroups {

    private SuiteGroups() {
    }

    public static boolean usesPhone(XmlSuite suite) {
        if (suite == null) return true;
        boolean named = !suite.getIncludedGroups().isEmpty();
        if (phone(suite.getIncludedGroups())) return true;
        for (XmlTest t : suite.getTests()) {
            java.util.List<String> groups = t.getIncludedGroups();
            if (!groups.isEmpty()) named = true;
            if (phone(groups)) return true;
        }
        return !named;
    }

    private static boolean phone(java.util.List<String> groups) {
        return groups.stream().anyMatch(g -> g.equalsIgnoreCase("Mob") || g.equalsIgnoreCase("Mobile") || g.equalsIgnoreCase("Hybrid"));
    }
}
