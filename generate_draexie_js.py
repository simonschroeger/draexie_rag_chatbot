import re
import uuid

html_content = open("frontend/draexie-v2.html", "r").read()
svg_content = re.search(r'<svg.*?</svg>', html_content, re.DOTALL).group(0)

# 1. Update SVG definition
svg_template = svg_content.replace('id="', 'id="${uid}-').replace('url(#', 'url(#${uid}-')
svg_template = svg_template.replace('class="', 'class="dxm-')

# Read the script file
script_content = open("frontend/.temp_script.js", "r").read()

# Extract EXPR, CAPTIONS (we'll just include the whole script and adapt it)
# We will construct a JS file that defines window.DraexieMascot
out_js = """
window.DraexieMascot = (() => {
  const STATES = ['idle', 'searching', 'analyzing', 'reranking', 'generating', 'found', 'error'];

  const SVG_TEMPLATE = (uid) => `
""" + svg_template.strip() + """
  `;

""" + script_content + """

  return Draexie;
})();
"""

with open("frontend/draexie-mascot.js.raw", "w") as f:
    f.write(out_js)
