package utils;

import org.openqa.selenium.By;
import org.openqa.selenium.SearchContext;
import org.openqa.selenium.WebElement;

import java.util.Arrays;
import java.util.List;

/**
 * Trova DEF-367 - one locator for an app that comes in more than one design (an old and a new layout, a mobile and a
 * desktop menu, a language that moves things): {@code AnyOf.anyOf(oldDesignLocator, newDesignLocator)} finds the element
 * with the first locator that matches on the page now. Any By works in it (XPath, CSS, id, a locator of another kind), so
 * a page object keeps ONE field per element and the test passes whichever design is on screen. Order the likeliest first.
 * <pre>
 *   private final By menu = AnyOf.anyOf(By.xpath("//button[@id='tour-5']"),             // top-bar design
 *                                       By.xpath("//a[contains(@class,'side-menu__item')]")); // side-bar design
 * </pre>
 */
public final class AnyOf extends By {

    private final List<By> options;

    private AnyOf(List<By> options) {
        this.options = options;
    }

    public static By anyOf(By... options) {
        if (options == null || options.length == 0) {
            throw new IllegalArgumentException("AnyOf needs at least one locator");
        }
        return options.length == 1 ? options[0] : new AnyOf(List.of(options));
    }

    @Override
    public List<WebElement> findElements(SearchContext context) {
        for (By option : options) {
            List<WebElement> found = option.findElements(context);
            if (!found.isEmpty()) {
                return found;
            }
        }
        return List.of();
    }

    @Override
    public String toString() {
        return "AnyOf" + Arrays.toString(options.toArray());
    }
}
