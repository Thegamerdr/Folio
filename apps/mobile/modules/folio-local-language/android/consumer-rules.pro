# LiteRT-LM 0.10.2 looks up SamplerConfig getters and callback methods by JNI name.
# Java references alone do not keep this ABI intact in a minified release build.
-keep class com.google.ai.edge.litertlm.** { *; }
