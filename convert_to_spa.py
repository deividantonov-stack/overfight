import os
import re

base_path = os.path.dirname(os.path.abspath(__file__))

def process_html_files():
    for root, dirs, files in os.walk(base_path):
        for file in files:
            if file.endswith(".html"):
                file_path = os.path.join(root, file)
                print(f"Processing: {file}")
                
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                original_content = content
                
                # 1. Remove old inline scripts block (Footer Year, Nav Toggle, Reveal)
                # Heuristic: Remove the specific block we know exists at the end of body
                regex_inline = r'<script>\s*// Footer година.*?const els = document\.querySelectorAll\("\.reveal"\).*?<\/script>'
                content = re.sub(regex_inline, '', content, flags=re.DOTALL)
                
                # Also remove the standalone dropdown script if present
                regex_dropdown = r'<script>\s*const dropdownTrigger = document\.querySelector\("\.dropdown-trigger"\).*?<\/script>'
                content = re.sub(regex_dropdown, '', content, flags=re.DOTALL)
                
                # 2. Remove old transitions script tag if generic
                content = content.replace('<script src="Resources/transitions.js"></script>', '')
                
                # 3. Inject New Module Scripts in HEAD (best for SPA logic persistence if we replaced body)
                # actually, if we replace body, body scripts die. So HEAD is correct.
                new_scripts = '''
    <script type="module" src="Resources/app.js"></script>
    <script type="module" src="Resources/transitions.js"></script>
</head>'''
                
                if '<script type="module" src="Resources/app.js">' not in content:
                    content = content.replace('</head>', new_scripts)
                
                # 4. Write back
                if content != original_content:
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(content)
                    print(f"  -> Updated {file}")
                else:
                    print(f"  -> No changes for {file}")

if __name__ == "__main__":
    process_html_files()
