package tests.unit.pins;

import org.testng.Assert;

import java.lang.reflect.Field;
import java.lang.reflect.Method;
import java.lang.reflect.Modifier;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Arrays;
import java.util.List;
import java.util.TreeSet;

/**
 * The saved lines a pin is compared with. Nothing is written unless asked (-DpinsWrite=true): a missing file fails.
 * No time is in the lines: a look a wait repeats counts once, line numbers and lambda numbers are taken out.
 */
final class PinGolden {

    private static final Path FOLDER = Path.of("src/test/resources/pins");

    private PinGolden() {
    }

    static String normalised(List<String> lines) {
        List<String> out = new ArrayList<>();
        for (String raw : lines) {
            String line = raw.replaceAll("\\$\\d+", "").replaceAll("(?<=[A-Za-z]):\\d+\\b", ":N").replace("\r", "");
            boolean repeatedLook = line.startsWith("find ") && !out.isEmpty() && out.get(out.size() - 1).equals(line);
            if (!repeatedLook) out.add(line);
        }
        return String.join("\n", out) + "\n";
    }

    static void matches(String name, List<String> lines) throws Exception {
        Path golden = FOLDER.resolve(name);
        String text = normalised(lines);
        if (Boolean.getBoolean("pinsWrite")) {
            Files.createDirectories(FOLDER);
            Files.writeString(golden, text, StandardCharsets.UTF_8);
            return;
        }
        Assert.assertTrue(Files.exists(golden), "no saved pin " + golden);
        Files.createDirectories(Path.of("target"));
        Files.writeString(Path.of("target", "actual-" + name), text, StandardCharsets.UTF_8);
        Assert.assertEquals(text, Files.readString(golden, StandardCharsets.UTF_8).replace("\r\n", "\n"), name);
    }

    /** Every member a subclass in another package reaches, wherever in the class's parents it is declared. */
    static List<String> reachable(Class<?> type) {
        TreeSet<String> out = new TreeSet<>();
        for (Class<?> c = type; c != null && c != Object.class; c = c.getSuperclass()) {
            for (Method m : c.getDeclaredMethods()) {
                if ((m.getModifiers() & (Modifier.PUBLIC | Modifier.PROTECTED)) != 0 && !m.isSynthetic()) {
                    out.add("method " + Modifier.toString(m.getModifiers() & (Modifier.PUBLIC | Modifier.PROTECTED | Modifier.STATIC)) + " "
                            + m.getReturnType().getSimpleName() + " " + m.getName() + Arrays.stream(m.getParameterTypes()).map(Class::getSimpleName).toList());
                }
            }
            for (Field f : c.getDeclaredFields()) {
                if ((f.getModifiers() & (Modifier.PUBLIC | Modifier.PROTECTED)) != 0) {
                    out.add("field " + Modifier.toString(f.getModifiers() & (Modifier.PUBLIC | Modifier.PROTECTED | Modifier.STATIC)) + " "
                            + f.getType().getSimpleName() + " " + f.getName());
                }
            }
            for (Class<?> n : c.getDeclaredClasses()) {
                if (Modifier.isPublic(n.getModifiers())) out.add("type " + n.getSimpleName());
            }
        }
        return new ArrayList<>(out);
    }
}
