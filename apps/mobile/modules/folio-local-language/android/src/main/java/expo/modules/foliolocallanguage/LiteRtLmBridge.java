package expo.modules.foliolocallanguage;

import com.google.ai.edge.litertlm.Backend;
import com.google.ai.edge.litertlm.Content;
import com.google.ai.edge.litertlm.Contents;
import com.google.ai.edge.litertlm.Conversation;
import com.google.ai.edge.litertlm.ConversationConfig;
import com.google.ai.edge.litertlm.Engine;
import com.google.ai.edge.litertlm.EngineConfig;
import com.google.ai.edge.litertlm.LogSeverity;
import com.google.ai.edge.litertlm.Message;
import com.google.ai.edge.litertlm.SamplerConfig;
import java.util.Collections;

/**
 * Java ABI adapter for LiteRT-LM. The current SDK artifacts carry newer Kotlin metadata than Expo's
 * locked Kotlin compiler can read, while their public JVM ABI remains callable from Java. Keeping
 * every SDK type in this one Java class avoids weakening Kotlin's metadata checks project-wide.
 */
final class LiteRtLmBridge implements AutoCloseable {
  private Engine engine;

  void initialize(String modelPath, String cacheDir) {
    close();
    Engine.Companion.setNativeMinLogSeverity(LogSeverity.ERROR);
    EngineConfig config =
        new EngineConfig(
            modelPath,
            new Backend.CPU(),
            null,
            null,
            4096,
            null,
            cacheDir);
    Engine candidate = new Engine(config);
    try {
      candidate.initialize();
    } catch (Throwable failure) {
      candidate.close();
      throw failure;
    }
    engine = candidate;
  }

  String complete(String systemInstruction, String prompt) {
    Engine current = engine;
    if (current == null) throw new IllegalStateException("Local model is not initialized.");
    ConversationConfig config =
        new ConversationConfig(
            Contents.Companion.of(systemInstruction),
            Collections.emptyList(),
            Collections.emptyList(),
            new SamplerConfig(20, 0.9, 0.2, 0),
            false);
    try (Conversation conversation = current.createConversation(config)) {
      Message response = conversation.sendMessage(prompt, Collections.emptyMap());
      StringBuilder text = new StringBuilder();
      for (Content content : response.getContents().getContents()) {
        if (content instanceof Content.Text) {
          text.append(((Content.Text) content).getText());
        }
      }
      return text.toString().trim();
    }
  }

  @Override
  public void close() {
    if (engine == null) return;
    try {
      engine.close();
    } finally {
      engine = null;
    }
  }
}
