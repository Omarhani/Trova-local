package utils;

import java.io.File;
import java.io.IOException;
import java.io.UncheckedIOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.stream.Stream;

/**
 * The files uploaded in FIA (Test Data → Attachments) - an Excel to import, a picture or a PDF to upload,
 * a JSON body … - by the name they have there:
 * <pre>
 *   driver.findElement(fileInput).sendKeys(Attachments.path("employees.xlsx"));   // or uploadAttachment(fileInput, …)
 *   given().multiPart("file", Attachments.file("profile.png"))…                   // RestAssured
 *   String body = Attachments.text("new-order.json");
 * </pre>
 * The FIA runner brings {@code data/attachments/} up to date before every run and AI session and leaves it there
 * (git-ignored), so a run from the IDE finds them too; {@code -DattachmentsDir=<path>} points elsewhere.
 */
public final class Attachments {

    private Attachments() {
    }

    /** The full path of an attachment, e.g. for sendKeys on an {@code <input type=file>}. Names ignore case. */
    public static String path(String name) {
        return find(name).toAbsolutePath().toString();
    }

    public static File file(String name) {
        return find(name).toAbsolutePath().toFile();
    }

    public static byte[] bytes(String name) {
        try {
            return Files.readAllBytes(find(name));
        } catch (IOException e) {
            throw new UncheckedIOException("Could not read the attachment \"" + name + "\"", e);
        }
    }

    /** The attachment as UTF-8 text (a JSON body, a CSV …). */
    public static String text(String name) {
        return new String(bytes(name), StandardCharsets.UTF_8);
    }

    /** The names of every attachment there. */
    public static List<String> names() {
        Path dir = dir();
        if (!Files.isDirectory(dir)) {
            return List.of();
        }
        try (Stream<Path> files = Files.list(dir)) {
            return files.filter(Files::isRegularFile)
                    .map(f -> f.getFileName().toString())
                    .filter(n -> !n.startsWith(".")) // the runner's own list of what it wrote
                    .sorted(String.CASE_INSENSITIVE_ORDER)
                    .toList();
        } catch (IOException e) {
            throw new UncheckedIOException("Could not list " + dir, e);
        }
    }

    public static boolean has(String name) {
        return names().stream().anyMatch(n -> n.equalsIgnoreCase(name));
    }

    private static Path find(String name) {
        Path dir = dir();
        for (String n : names()) {
            if (n.equalsIgnoreCase(name)) {
                return dir.resolve(n);
            }
        }
        throw new IllegalStateException("No attachment \"" + name + "\" in " + dir.toAbsolutePath() + " (there are " + names()
                + ") - upload it in FIA > Test Data > Attachments; a run from FIA brings it here");
    }

    private static Path dir() {
        return Path.of(System.getProperty("attachmentsDir", "data/attachments"));
    }
}
