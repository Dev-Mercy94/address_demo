import pypdf
import re

pdf_path = r"C:\Users\se6po\Downloads\Tenkasi Po & Tk.pdf"
reader = pypdf.PdfReader(pdf_path)

all_boxes = []

for page_idx, page in enumerate(reader.pages):
    text = page.extract_text()
    # Normalize spaces in IDs like 'T -0001' or 'T - 0001' -> 'T-0001'
    # Also normalize 'T k & D t' -> 'Tk & Dt', 'P o & T k' -> 'Po & Tk'
    
    # Split page by Card headers: T-XXXX or T -XXXX or M-XXXX
    # Regex lookahead: (?:^|\n)(?=[TmtI1]\s*-\s*\d+)
    boxes = re.split(r'(?=(?:^|\n)[MTmtI1]\s*-\s*\d+)', text)
    valid_boxes_in_page = []
    for b in boxes:
        b_clean = b.strip()
        # Header text like "Sanju Typed..." at the very beginning of the page
        if re.search(r'^[MTmtI1]\s*-\s*\d+', b_clean):
            valid_boxes_in_page.append(b_clean)
        elif 'T -' in b_clean or 'T-' in b_clean:
            # maybe header preceded it
            m = re.search(r'[MTmtI1]\s*-\s*\d+.*', b_clean, re.DOTALL)
            if m:
                valid_boxes_in_page.append(m.group(0).strip())
    
    print(f"Page {page_idx+1}: Found {len(valid_boxes_in_page)} boxes")
    all_boxes.extend(valid_boxes_in_page)

print(f"\nTotal boxes extracted across all 10 pages: {len(all_boxes)}")
print("\n--- FIRST 3 BOXES ---")
for i, b in enumerate(all_boxes[:3]):
    print(f"Box #{i+1}:\n{b}\n----------------")

print("\n--- LAST 3 BOXES ---")
for i, b in enumerate(all_boxes[-3:]):
    print(f"Box #{len(all_boxes)-3+i+1}:\n{b}\n----------------")
