import re

html_content = open("frontend/draexie-v2.html", "r").read()
svg_content = re.search(r'<svg.*?</svg>', html_content, re.DOTALL).group(0)
script_content = re.search(r'<script>(.*?)</script>', html_content, re.DOTALL).group(1)

svg_template = svg_content.replace('id="', 'id="${this._uid}-').replace('url(#', 'url(#${this._uid}-').replace('`', '\\`')

js_code = f"""
window.DraexieMascot = (() => {{
  {script_content}
  // Transform Draexie to a class constructor
  class Mascot {{
      constructor(host, options = {{}}) {{
          this.host = host;
          this.options = options;
          this._uid = 'dxm' + Math.random().toString(36).substr(2, 9);
          
          this.host.innerHTML = this._getSvg();
          // We need to re-map elements
          this.initElements();
          Draexie.init(this); // Assuming we refactored Draexie to take an instance
      }}
      
      _getSvg() {{
          return `{svg_template}`;
      }}
      
      initElements() {{
          this._el = {{}};
          const map = ['draexie', 'd-mascot', 'd-head', 'd-body', 'd-arm-left', 'd-arm-right', 'd-magnifier', 'd-tablet', 'd-document', 'd-sparks', 'd-think', 'd-typing', 'd-orbit', 'd-cheeks', 'd-mouth', 'd-mouth-shape', 'd-antenna-tip', 'd-antenna', 'd-aura', 'd-type-1', 'd-type-2', 'd-type-3', 'd-glitch', 'd-eye-left-pos', 'd-eye-right-pos', 'd-eye-left-blink', 'd-eye-right-blink', 'd-eye-left-expr', 'd-eye-right-expr', 'd-ray', 'd-ray-1', 'd-ray-2'];
          map.forEach(id => {{
              this._el[id] = this.host.querySelector('#' + this._uid + '-' + id);
          }});
          this._el['chunks'] = this.host.querySelectorAll('#' + this._uid + '-d-orbit .chunk');
      }}
  }}
  return Mascot;
}})();
"""
with open("frontend/draexie-mascot.js", "w") as f:
    f.write(js_code)
