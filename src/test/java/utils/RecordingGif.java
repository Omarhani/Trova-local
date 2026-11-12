package utils;

import javax.imageio.IIOImage;
import javax.imageio.ImageIO;
import javax.imageio.ImageTypeSpecifier;
import javax.imageio.ImageWriter;
import javax.imageio.metadata.IIOMetadata;
import javax.imageio.metadata.IIOMetadataNode;
import javax.imageio.stream.ImageOutputStream;
import java.awt.Graphics2D;
import java.awt.RenderingHints;
import java.awt.image.BufferedImage;
import java.io.File;
import java.io.IOException;
import java.util.List;

/** A recording's files: where its frames are, their size, and the one GIF made of them for download. */
final class RecordingGif {

    /** Width of the downloadable GIF - smaller, because GIF colour quantising is slow. */
    private static final int GIF_WIDTH = 960;

    private RecordingGif() {
    }

    static File frameFile(File framesDir, int index) {
        return new File(framesDir, String.format("%03d.jpg", index));
    }

    // ---------- GIF (background, after the test) ----------

    static void build(File framesDir, List<Integer> durations, File gifFile) {
        ImageWriter writer = ImageIO.getImageWritersBySuffix("gif").next();
        try (ImageOutputStream output = ImageIO.createImageOutputStream(gifFile)) {
            writer.setOutput(output);
            writer.prepareWriteSequence(null);
            for (int i = 0; i < durations.size(); i++) {
                BufferedImage frame = ImageIO.read(frameFile(framesDir, i));
                if (frame != null) {
                    BufferedImage small = scale(frame, GIF_WIDTH);
                    writer.writeToSequence(new IIOImage(small, null, gifFrameMetadata(writer, durations.get(i), i == 0)), null);
                }
            }
            writer.endWriteSequence();
        } catch (IOException e) {
            System.out.println("⚠️ GIF not written for " + gifFile.getName() + ": " + e.getMessage());
        } finally {
            writer.dispose();
        }
    }

    private static IIOMetadata gifFrameMetadata(ImageWriter writer, int durationMs, boolean first) throws IOException {
        IIOMetadata metadata = writer.getDefaultImageMetadata(
                ImageTypeSpecifier.createFromBufferedImageType(BufferedImage.TYPE_INT_RGB), null);
        String format = metadata.getNativeMetadataFormatName();
        IIOMetadataNode root = (IIOMetadataNode) metadata.getAsTree(format);

        IIOMetadataNode control = child(root, "GraphicControlExtension");
        control.setAttribute("disposalMethod", "none");
        control.setAttribute("userInputFlag", "FALSE");
        control.setAttribute("transparentColorFlag", "FALSE");
        control.setAttribute("delayTime", String.valueOf(Math.max(1, durationMs / 10))); // 1/100 s
        control.setAttribute("transparentColorIndex", "0");

        if (first) {
            // loop forever - the extension only belongs on the first frame
            IIOMetadataNode appExtension = new IIOMetadataNode("ApplicationExtension");
            appExtension.setAttribute("applicationID", "NETSCAPE");
            appExtension.setAttribute("authenticationCode", "2.0");
            appExtension.setUserObject(new byte[]{1, 0, 0});
            child(root, "ApplicationExtensions").appendChild(appExtension);
        }

        metadata.setFromTree(format, root);
        return metadata;
    }

    private static IIOMetadataNode child(IIOMetadataNode root, String name) {
        for (int i = 0; i < root.getLength(); i++) {
            if (root.item(i).getNodeName().equalsIgnoreCase(name)) {
                return (IIOMetadataNode) root.item(i);
            }
        }
        IIOMetadataNode node = new IIOMetadataNode(name);
        root.appendChild(node);
        return node;
    }

    static BufferedImage scale(BufferedImage source, int maxWidth) {
        int width = Math.min(maxWidth, source.getWidth());
        int height = (int) Math.round(source.getHeight() * (width / (double) source.getWidth()));
        BufferedImage scaled = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = scaled.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        g.drawImage(source, 0, 0, width, height, null);
        g.dispose();
        return scaled;
    }
}
