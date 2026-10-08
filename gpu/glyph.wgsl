struct GlyphVertex{@location(0) p:vec2f,@location(1) uv:vec2f,@location(2) color:vec4f};
struct GlyphOut{@builtin(position) p:vec4f,@location(0) uv:vec2f,@location(1) color:vec4f};
@group(0) @binding(0) var atlas:texture_2d<f32>;
@group(0) @binding(1) var glyphSampler:sampler;
@group(0) @binding(2) var<uniform> viewport:vec4f;
@vertex fn glyphVertex(v:GlyphVertex)->GlyphOut{return GlyphOut(vec4f(v.p*viewport.xy+viewport.zw,0,1),v.uv,v.color);}
@fragment fn glyphFragment(v:GlyphOut)->@location(0) vec4f{
 let distance=textureSample(atlas,glyphSampler,v.uv).r;let width=max(fwidth(distance)*.72,.015);
 let alpha=smoothstep(.5-width,.5+width,distance)*v.color.a;
 return vec4f(v.color.rgb*alpha,alpha);
}
