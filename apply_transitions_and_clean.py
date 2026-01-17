import os
import re

# Set correct base path
base_path = os.path.dirname(os.path.abspath(__file__))

# Emoji Map (Extend as needed)
emoji_map = {
    '✓': '<i class="fa-solid fa-check"></i>',
    '✔': '<i class="fa-solid fa-check"></i>',
    '▸': '<i class="fa-solid fa-caret-right"></i>',
    '►': '<i class="fa-solid fa-play"></i>',
    '•': '<i class="fa-solid fa-circle" style="font-size: 0.5em; vertical-align: middle;"></i>',
    '→': '<i class="fa-solid fa-arrow-right"></i>',
    '←': '<i class="fa-solid fa-arrow-left"></i>',
    '📞': '<i class="fa-solid fa-phone"></i>',
    '📧': '<i class="fa-solid fa-envelope"></i>',
    '📍': '<i class="fa-solid fa-location-dot"></i>',
    # Add generic fallback for safety if specific ones persist?
}

def process_html_files():
    # 1. Walk through all files
    for root, dirs, files in os.walk(base_path):
        for file in files:
            if file.endswith(".html"):
                file_path = os.path.join(root, file)
                print(f"Processing: {file}")
                
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                
                original_content = content
                
                # 2. Inject transitions.js if not present
                script_tag = '<script src="Resources/transitions.js"></script>'
                if 'transitions.js' not in content:
                    # Insert before </body>
                    if '</body>' in content:
                        content = content.replace('</body>', f'{script_tag}\n</body>')
                    else:
                        content += f'\n{script_tag}'
                        
                # 3. Replace Emojis
                for char, icon in emoji_map.items():
                    content = content.replace(char, icon)
                
                # 4. Write back if changed
                if content != original_content:
                    with open(file_path, 'w', encoding='utf-8') as f:
                        f.write(content)
                    print(f"  -> Updated {file}")
                else:
                    print(f"  -> No changes for {file}")

if __name__ == "__main__":
    process_html_files()
