"""Render figure crops from PAM.pdf into docs/static/images/ at 300 dpi.

Crops are vertical bands of a page: the paper's figures all span the text
width, so x is fixed to the text margins and only y0/y1 vary per figure.
All values are fractions of the page box.
"""
import pathlib

import fitz

PDF = pathlib.Path("docs/static/pdfs/PAM.pdf")
OUT = pathlib.Path("docs/static/images")
DPI = 300

X0, X1 = 0.10, 0.90  # text margins, used by full-width figures

# name -> (1-indexed page, y0 fraction, y1 fraction)
# Entries may optionally be (page, x0, x1, y0, y1) to override the shared
# X0/X1 text-margin crop -- fig3 is a right-column inset figure with text
# wrapped on its left, not a full-width figure like the rest.
FIGURES = {
    "fig1_motivation":          (2,  0.06, 0.28),
    "fig2_overview":            (3,  0.06, 0.26),
    "fig3_pam_example":         (4,  0.565, 0.94, 0.545, 0.785),
    "fig4_tasks":               (5,  0.06, 0.193),
    "fig5_multiday":            (6,  0.06, 0.31),
    "fig7_memory_evolution":    (8,  0.06, 0.305),
    "fig9_cameras":             (16, 0.06, 0.23),
    "fig10_pertask":            (17, 0.215, 0.43),
    "fig11_selfevolving":       (18, 0.155, 0.40),
    "fig20_medication":         (25, 0.533, 0.63),
    "fig21_medication_results": (26, 0.06, 0.335),
    "fig22_transfer":           (27, 0.06, 0.60),
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(PDF)
    zoom = DPI / 72.0
    for name, spec in FIGURES.items():
        if len(spec) == 5:
            page_no, x0, x1, y0, y1 = spec
        else:
            page_no, y0, y1 = spec
            x0, x1 = X0, X1
        page = doc[page_no - 1]
        r = page.rect
        clip = fitz.Rect(
            r.x0 + x0 * r.width,
            r.y0 + y0 * r.height,
            r.x0 + x1 * r.width,
            r.y0 + y1 * r.height,
        )
        pix = page.get_pixmap(matrix=fitz.Matrix(zoom, zoom), clip=clip)
        dest = OUT / f"{name}.png"
        pix.save(dest)
        print(f"{dest}  {pix.width}x{pix.height}")


if __name__ == "__main__":
    main()
