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

X0, X1 = 0.10, 0.90  # text margins, shared by every figure below

# name -> (1-indexed page, y0 fraction, y1 fraction)
FIGURES = {
    "fig1_motivation":          (2,  0.06, 0.28),
    "fig2_overview":            (4,  0.06, 0.255),
    "fig4_tasks":               (5,  0.06, 0.196),
    "fig5_multiday":            (6,  0.06, 0.318),
    "fig6_transfer_A2B":        (7,  0.06, 0.318),
    "fig7_memory_evolution":    (8,  0.06, 0.30),
    "fig10_cameras":            (17, 0.06, 0.23),
    "fig11_pertask":            (18, 0.06, 0.30),
    "fig12_selfevolving":       (22, 0.06, 0.325),
    "fig21_vitamin":            (28, 0.645, 0.755),
    "fig22_vitamin_results":    (30, 0.06, 0.325),
    "fig23_transfer_B2A":       (30, 0.395, 0.625),
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    doc = fitz.open(PDF)
    zoom = DPI / 72.0
    for name, spec in FIGURES.items():
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
