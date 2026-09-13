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
import java.util.Timer;
import java.util.TimerTask;
import java.util.concurrent.atomic.AtomicBoolean;
import android.os.SystemClock;
import android.util.Log;

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
      // SDK 0.10.2 has cancellation but no per-turn output-token limit. Keep a slow CPU turn
      // bounded; cancellation only discards optional wording, never the deterministic answer.
      Object lifetime = new Object();
      AtomicBoolean active = new AtomicBoolean(true);
      AtomicBoolean timedOut = new AtomicBoolean(false);
      Timer deadline = new Timer("Melo language deadline", true);
      long started = SystemClock.elapsedRealtime();
      deadline.schedule(new TimerTask() {
        @Override public void run() {
          synchronized (lifetime) {
            if (!active.get()) return;
            timedOut.set(true);
            try { conversation.cancelProcess(); }
            catch (RuntimeException ignored) { /* The worker still owns cleanup. */ }
          }
        }
      }, 45_000L);
      Message response;
      try {
        response = conversation.sendMessage(prompt, Collections.emptyMap());
        if (timedOut.get()) throw new IllegalStateException("Local language deadline exceeded.");
      } finally {
        synchronized (lifetime) { active.set(false); deadline.cancel(); }
        if (timedOut.get()) Log.i("MeloLocalLanguage", "Generation reached the 45s deadline.");
      }
      StringBuilder text = new StringBuilder();
      for (Content content : response.getContents().getContents()) {
        if (content instanceof Content.Text) {
          text.append(((Content.Text) content).getText());
        }
      }
      // Local operational metadata only: never log prompts, completions or financial context.
      Log.i("MeloLocalLanguage", "Generation completed in "
          + (SystemClock.elapsedRealtime() - started) + "ms; chars=" + text.length());
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
