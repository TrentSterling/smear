"""Build a deterministic R8 signed-distance atlas; no browser font rasterization."""
from pathlib import Path
from PIL import Image, ImageFont, ImageDraw
from scipy.ndimage import distance_transform_edt
from fontTools import subset
from fontTools.ttLib import TTFont
import numpy as np
import json, gzip, base64

root=Path('vendor/fonts'); chars=''.join(chr(i) for i in range(32,127))+''.join(chr(i) for i in range(160,256))+'×–—‘’“”…→←↑↓↔•−✓✕'
size=48; pad=7; cell=80; width=2048; cols=width//cell
atlas=np.zeros((2048,2048),dtype=np.uint8); faces=[]; index=0
for name in ['Barlow-Regular','BarlowCondensed-SemiBold']:
    source=root/(name+'.ttf'); font=ImageFont.truetype(str(source),size); glyphs={}
    for char in dict.fromkeys(chars):
        left,top,right,bottom=font.getbbox(char,anchor='ls'); w=right-left+pad*2; h=bottom-top+pad*2
        if w>cell or h>cell: raise RuntimeError(char)
        x=(index%cols)*cell;y=(index//cols)*cell; index+=1
        im=Image.new('L',(w,h));ImageDraw.Draw(im).text((pad-left,pad-top),char,font=font,fill=255,anchor='ls')
        bitmap=np.array(im)>127
        sdf=np.clip(128+(distance_transform_edt(bitmap)-distance_transform_edt(~bitmap))*16,0,255).astype(np.uint8) if bitmap.any() else np.zeros((h,w),np.uint8)
        atlas[y:y+h,x:x+w]=sdf
        glyphs[char]={'uv':[x/width,y/2048,(x+w)/width,(y+h)/2048],'box':[(left-pad)/size,(top-pad)/size,w/size,h/size],'advance':font.getlength(char)/size}
    f=TTFont(source); options=subset.Options(); sub=subset.Subsetter(options=options);sub.populate(text=chars);sub.subset(f);f.flavor='woff';f.save(root/(name+'.woff'))
    faces.append({'name':name,'glyphs':glyphs,'ascent':font.getmetrics()[0]/size,'descent':font.getmetrics()[1]/size,'woff':base64.b64encode((root/(name+'.woff')).read_bytes()).decode()})
data={'width':width,'height':2048,'faces':faces,'data':base64.b64encode(gzip.compress(atlas.tobytes(),mtime=0)).decode()}
Path('assets/glyphs.json').write_text(json.dumps(data,separators=(',',':')),encoding='utf8')
Image.fromarray(atlas).save('tools/out/gauntlet-v46/glyph-atlas.png')
print('Baked',index,'glyphs;',len(data['data']),'base64 bytes')
