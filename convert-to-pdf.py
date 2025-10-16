#!/usr/bin/env python3
"""
Convert Markdown to PDF for HAZ API Documentation
Uses markdown2 and weasyprint for conversion
"""

import os
import subprocess
import sys

def convert_markdown_to_pdf(md_file, pdf_file):
    """Convert markdown file to PDF using pandoc if available, otherwise weasyprint"""

    # Try pandoc first (best quality)
    try:
        subprocess.run([
            'pandoc',
            md_file,
            '-o', pdf_file,
            '--pdf-engine=xelatex',
            '-V', 'geometry:margin=1in',
            '-V', 'fontsize=11pt',
            '-V', 'colorlinks=true',
            '--toc',
            '--toc-depth=2'
        ], check=True)
        print(f"✅ PDF creado exitosamente usando pandoc: {pdf_file}")
        return True
    except (subprocess.CalledProcessError, FileNotFoundError):
        print("⚠️  Pandoc no disponible, intentando método alternativo...")

    # Try weasyprint
    try:
        import markdown
        from weasyprint import HTML, CSS
        from weasyprint.text.fonts import FontConfiguration

        # Read markdown file
        with open(md_file, 'r', encoding='utf-8') as f:
            md_content = f.read()

        # Convert markdown to HTML
        html_content = markdown.markdown(
            md_content,
            extensions=['tables', 'fenced_code', 'codehilite']
        )

        # Add CSS styling
        css_content = """
        @page {
            size: A4;
            margin: 2cm;
        }
        body {
            font-family: Arial, sans-serif;
            font-size: 11pt;
            line-height: 1.6;
            color: #333;
        }
        h1 {
            color: #667eea;
            font-size: 24pt;
            margin-top: 20pt;
            margin-bottom: 10pt;
            page-break-before: always;
        }
        h1:first-of-type {
            page-break-before: avoid;
        }
        h2 {
            color: #764ba2;
            font-size: 18pt;
            margin-top: 15pt;
            margin-bottom: 8pt;
            border-bottom: 2px solid #667eea;
            padding-bottom: 5pt;
        }
        h3 {
            color: #667eea;
            font-size: 14pt;
            margin-top: 12pt;
            margin-bottom: 6pt;
        }
        code {
            background-color: #f4f4f4;
            padding: 2pt 4pt;
            border-radius: 3pt;
            font-family: 'Courier New', monospace;
            font-size: 10pt;
        }
        pre {
            background-color: #f8f8f8;
            border: 1px solid #ddd;
            border-radius: 5pt;
            padding: 10pt;
            overflow-x: auto;
            font-size: 9pt;
        }
        pre code {
            background: none;
            padding: 0;
        }
        table {
            border-collapse: collapse;
            width: 100%;
            margin: 10pt 0;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 8pt;
            text-align: left;
        }
        th {
            background-color: #667eea;
            color: white;
            font-weight: bold;
        }
        tr:nth-child(even) {
            background-color: #f9f9f9;
        }
        a {
            color: #667eea;
            text-decoration: none;
        }
        blockquote {
            border-left: 4px solid #667eea;
            padding-left: 15pt;
            margin-left: 0;
            font-style: italic;
            color: #666;
        }
        """

        # Create full HTML document
        full_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Guía de Integración API Relier - HAZ Group</title>
        </head>
        <body>
            {html_content}
        </body>
        </html>
        """

        # Convert to PDF
        font_config = FontConfiguration()
        html_obj = HTML(string=full_html)
        css_obj = CSS(string=css_content, font_config=font_config)
        html_obj.write_pdf(pdf_file, stylesheets=[css_obj], font_config=font_config)

        print(f"✅ PDF creado exitosamente usando weasyprint: {pdf_file}")
        return True

    except ImportError:
        print("⚠️  Weasyprint no disponible, instalando dependencias...")
        try:
            subprocess.run([sys.executable, '-m', 'pip', 'install', 'markdown', 'weasyprint'], check=True)
            print("✅ Dependencias instaladas, intente nuevamente ejecutar el script")
            return False
        except:
            pass

    # Fallback: create simple HTML version
    print("⚠️  Creando versión HTML como alternativa...")
    try:
        import markdown

        with open(md_file, 'r', encoding='utf-8') as f:
            md_content = f.read()

        html_content = markdown.markdown(
            md_content,
            extensions=['tables', 'fenced_code', 'codehilite']
        )

        html_file = pdf_file.replace('.pdf', '.html')

        full_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>Guía de Integración API Relier - HAZ Group</title>
            <style>
                body {{
                    font-family: Arial, sans-serif;
                    max-width: 900px;
                    margin: 40px auto;
                    padding: 20px;
                    line-height: 1.6;
                }}
                h1 {{ color: #667eea; }}
                h2 {{ color: #764ba2; border-bottom: 2px solid #667eea; padding-bottom: 5px; }}
                code {{ background: #f4f4f4; padding: 2px 6px; border-radius: 3px; }}
                pre {{ background: #f8f8f8; padding: 15px; border-radius: 5px; overflow-x: auto; }}
                table {{ border-collapse: collapse; width: 100%; margin: 20px 0; }}
                th, td {{ border: 1px solid #ddd; padding: 12px; text-align: left; }}
                th {{ background: #667eea; color: white; }}
            </style>
        </head>
        <body>
            {html_content}
        </body>
        </html>
        """

        with open(html_file, 'w', encoding='utf-8') as f:
            f.write(full_html)

        print(f"✅ HTML creado: {html_file}")
        print(f"💡 Abra el archivo HTML en su navegador y use 'Imprimir > Guardar como PDF'")
        return True

    except Exception as e:
        print(f"❌ Error: {str(e)}")
        return False

if __name__ == '__main__':
    md_file = '/Users/richardmas/latcom-fix/HAZ_GUIA_INTEGRACION_API.md'
    pdf_file = '/Users/richardmas/latcom-fix/HAZ_GUIA_INTEGRACION_API.pdf'

    if not os.path.exists(md_file):
        print(f"❌ Archivo no encontrado: {md_file}")
        sys.exit(1)

    success = convert_markdown_to_pdf(md_file, pdf_file)
    sys.exit(0 if success else 1)
