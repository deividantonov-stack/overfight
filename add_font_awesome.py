
import os

files = [
    "about.html", "competitors.html", "contacts.html", "gallery.html",
    "gallerylageri.html", "gallerytrenirovki.html", "galleryuspehi.html",
    "news.html", "schedule.html", "sofiagradprix.html", "trainers.html",
    "trainerDAMYAN.html", "trainerDEIVID.html", "trainerIVO.html"
]

cdn_link = '<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" integrity="sha512-DTOQO9RWCH3ppGqcWaEA1BIZOC6xxalwEsw9c2QQeAIftl+Vegovlnee1c9QX4TctnWMn13TZye+giMm8e2LwA==" crossorigin="anonymous" referrerpolicy="no-referrer" />'
base_path = os.path.dirname(os.path.abspath(__file__))

for fname in files:
    path = os.path.join(base_path, fname)
    if not os.path.exists(path):
        print(f"Skipping {fname}, not found.")
        continue
    
    with open(path, "r", encoding="utf-8") as f:
        content = f.read()
    
    if "font-awesome" in content:
        print(f"Skipping {fname}, already has FontAwesome.")
        continue
        
    if "</head>" in content:
        new_content = content.replace("</head>", f"  {cdn_link}\n</head>")
        with open(path, "w", encoding="utf-8") as f:
            f.write(new_content)
        print(f"Updated {fname}")
    else:
        print(f"Warning: No </head> tag in {fname}")
