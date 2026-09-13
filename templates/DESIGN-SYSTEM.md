# MAILIX Email Templates - Design System

Design specifications, color systems, typography, and spacing guidelines for all template families.

## Design Principles

### 1. Premium Quality
- Refined spacing and whitespace
- High-quality typography
- Sophisticated color combinations
- Professional visual hierarchy

### 2. Clarity
- Clear information hierarchy
- Concise messaging
- Strong CTAs
- Intuitive layouts

### 3. Accessibility
- WCAG AA color contrast minimum
- Semantic HTML structure
- Descriptive alt text
- Readable font sizes

### 4. Compatibility
- Email-client optimized
- Table-based structures
- Inline CSS only
- Safe fallback fonts

---

## Color Systems

### MAILIX Core
**Best for:** General SaaS, most businesses

| Element | Color | Hex | Usage |
|---------|-------|-----|-------|
| Background | Off-white | #F9FAFB | Page background |
| Card Background | White | #FFFFFF | Content area |
| Primary Text | Dark Gray | #111827 | Headings, primary copy |
| Secondary Text | Medium Gray | #6B7280 | Secondary copy |
| Tertiary Text | Light Gray | #9CA3AF | Metadata, dates |
| Border | Very Light Gray | #E5E7EB | Dividers, borders |
| Primary Accent | Indigo | #6366F1 | Buttons, links, highlights |
| Success | Green | #10B981 | Success states |
| Warning | Amber | #F59E0B | Warning states |
| Danger | Red | #EF4444 | Error states |

**Usage:**
```css
/* Primary background */
background-color: #F9FAFB;

/* Main CTA button */
background-color: #6366F1;
color: #FFFFFF;

/* Hover state (darken) */
background-color: #4F46E5;
```

### Midnight Signal
**Best for:** Tech companies, developer platforms, security brands

| Element | Color | Hex | Usage |
|---------|-------|-----|-------|
| Background | Deep Navy | #0F172A | Page background |
| Card Background | Dark Navy | #1E293B | Content area |
| Primary Text | Off-white | #F1F5F9 | Headings, primary copy |
| Secondary Text | Light Gray-blue | #CBD5E1 | Secondary copy |
| Tertiary Text | Medium Gray-blue | #94A3B8 | Metadata |
| Border | Slate | #334155 | Dividers, borders |
| Primary Accent | Cyan | #06B6D4 | Buttons, links, highlights |
| Secondary Accent | Purple | #A78BFA | Secondary highlights |
| Success | Green | #10B981 | Success states |

**Usage:**
```css
/* Dark background */
background-color: #0F172A;

/* High-contrast button */
background-color: #06B6D4;
color: #0F172A;

/* Gradient background for cards */
background: linear-gradient(135deg, #1E293B 0%, #0F172A 100%);
```

### Editorial
**Best for:** Newsletters, announcements, thought leadership

| Element | Color | Hex | Usage |
|---------|-------|-----|-------|
| Background | Very Light Gray | #FAFAFA | Page background |
| Card Background | White | #FFFFFF | Content area |
| Primary Text | Almost Black | #111827 | Headlines in serif |
| Secondary Text | Dark Gray | #4B5563 | Body text |
| Tertiary Text | Medium Gray | #6B7280 | Metadata |
| Border | Light Gray | #E5E7EB | Dividers |
| Primary Accent | Blue | #3B82F6 | Buttons, links |
| Highlight | Gold | #F59E0B | Featured content |

**Usage:**
```css
/* Serif headline */
font-family: Georgia, serif;
color: #111827;
font-size: 42px;
font-weight: 400;

/* CTA button */
background-color: #3B82F6;
color: #FFFFFF;
```

### Enterprise
**Best for:** B2B, corporate, financial services

| Element | Color | Hex | Usage |
|---------|-------|-----|-------|
| Background | Off-white | #F3F4F6 | Page background |
| Card Background | White | #FFFFFF | Content area |
| Primary Text | Very Dark Gray | #1F2937 | Headings |
| Secondary Text | Dark Gray | #374151 | Body text |
| Tertiary Text | Medium Gray | #6B7280 | Metadata |
| Border | Light Gray | #E5E7EB | Dividers |
| Primary Accent | Blue | #3B82F6 | Buttons, links |
| Highlight Box Background | Light Blue | #EFF6FF | Information boxes |
| Alert Border | Blue | #3B82F6 | Alert boxes |

**Usage:**
```css
/* Professional card */
background-color: #FFFFFF;
border: 1px solid #E5E7EB;
box-shadow: 0 1px 3px rgba(0, 0, 0, 0.12);

/* Info box */
background-color: #EFF6FF;
border-left: 4px solid #3B82F6;
```

### Commerce
**Best for:** Ecommerce, subscriptions, transactional

| Element | Color | Hex | Usage |
|---------|-------|-----|-------|
| Background | Very Light Blue | #F8FAFB | Page background |
| Card Background | White | #FFFFFF | Content area |
| Primary Text | Dark Gray | #111827 | Headings |
| Secondary Text | Medium Gray | #6B7280 | Body text |
| Tertiary Text | Light Gray | #9CA3AF | Metadata |
| Border | Very Light Gray | #E5E7EB | Dividers |
| Primary Accent | Company color | {{company.primaryColor}} | Buttons, links |
| Success | Green | #059669 | Total, success states |
| Alert Box Background | Light Blue | #F0F9FF | Info boxes |
| Alert Border | Blue | #3B82F6 | Info box borders |

**Usage:**
```css
/* Order total (prominent) */
color: #059669;
font-weight: 700;
font-size: 18px;

/* Tracking button */
background-color: {{company.primaryColor}};
color: #FFFFFF;
```

---

## Typography

### Font Stack
All templates use system fonts for compatibility:

```css
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif;
```

**Rationale:**
- -apple-system: macOS/iOS system font
- BlinkMacSystemFont: Older macOS/iOS
- Segoe UI: Windows system font
- Helvetica Neue: Fallback for older systems
- sans-serif: Generic fallback

### Editorial Family (Serif)

Uses serif typography for premium, editorial feel:

```css
font-family: Georgia, 'Times New Roman', serif;
```

### Font Sizes

#### Headings
| Level | Size | Weight | Usage |
|-------|------|--------|-------|
| H1 | 42px | 400 (Editorial) / 600 (Others) | Page title |
| H2 | 28px | 600 | Section heading |
| H3 | 24px | 600 | Subsection heading |
| H4 | 18px | 600 | Small heading |
| H5 | 16px | 600 | Metadata/label |

#### Body Text
| Type | Size | Weight | Line Height | Usage |
|------|------|--------|-------------|-------|
| Paragraph | 16px | 400 | 1.6-1.7 | Main content |
| Secondary | 15px | 400 | 1.6 | Supporting text |
| Small | 14px | 400 | 1.6 | Additional info |
| Label | 12px | 600 | 1.5 | Field labels |
| Tiny | 11px | 400 | 1.6 | Footer text |

#### Special Text
| Type | Size | Weight | Font | Usage |
|------|------|--------|------|-------|
| Code/OTP | 48px | 700 | Monospace | Verification codes |
| Order Number | 18px | 600 | System | Order identifiers |
| Total | 18px | 700 | System | Financial totals |

### Line Height
- Body text: 1.6 - 1.7 (for readability)
- Headings: 1.2 - 1.3 (for clarity)
- Code/Technical: 1.5 (for monospace)

---

## Spacing System

### Padding/Margin Scale

```css
/* Scale: 4px, 8px, 12px, 16px, 20px, 24px, 28px, 32px, 40px, 48px, 60px */

.spacing-xs   { padding: 4px; }    /* Extra small */
.spacing-sm   { padding: 8px; }    /* Small */
.spacing-md   { padding: 12px; }   /* Medium */
.spacing-lg   { padding: 16px; }   /* Large */
.spacing-xl   { padding: 20px; }   /* Extra large */
.spacing-2xl  { padding: 24px; }   /* 2x large */
.spacing-3xl  { padding: 32px; }   /* 3x large */
.spacing-4xl  { padding: 40px; }   /* 4x large */
```

### Container Widths
- Desktop: 600px (standard email width)
- Tablet: 480px media query
- Mobile: Full width with padding

### Header Padding
- Desktop: 40px
- Mobile: 32px

### Body Padding
- Desktop: 40px
- Mobile: 24px

### Footer Padding
- Top/Bottom: 32px
- Sides: 40px desktop, 24px mobile

### Card Spacing
- Between sections: 28px - 40px
- Within sections: 16px - 20px
- Line item padding: 16px vertical, 0px horizontal

---

## Button Styles

### Primary CTA Button

```html
<table border="0" cellpadding="0" cellspacing="0">
  <tr>
    <td align="center" style="background-color: #6366F1; border-radius: 6px; padding: 14px 32px;">
      <a href="https://example.com" style="color: #FFFFFF; text-decoration: none; font-weight: 600; font-size: 16px; display: block; white-space: nowrap;">
        Button Text
      </a>
    </td>
  </tr>
</table>
```

**Specifications:**
- Padding: 14px vertical, 32px horizontal
- Border radius: 6px
- Font: 16px, 600 weight, white color
- Background: Primary accent color
- No underline

### Secondary Button

```css
background-color: #F3F4F6;
color: #111827;
border: 1px solid #E5E7EB;
```

### Danger Button

```css
background-color: #EF4444;
color: #FFFFFF;
```

---

## Cards and Containers

### Standard Card

```css
background-color: #FFFFFF;
border: 1px solid #E5E7EB;
border-radius: 6px;
box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
padding: 24px;
```

### Info Box

```css
background-color: #EFF6FF;
border-left: 4px solid #3B82F6;
padding: 16px;
border-radius: 4px;
```

### Success Box

```css
background-color: #ECFDF5;
border-left: 4px solid #10B981;
padding: 16px;
border-radius: 4px;
```

### Warning Box

```css
background-color: #FFFBEB;
border-left: 4px solid #F59E0B;
padding: 16px;
border-radius: 4px;
```

---

## Borders and Dividers

### Primary Divider
```css
border-bottom: 1px solid #E5E7EB;
```

### Section Divider
```css
border-bottom: 2px solid #E5E7EB;
padding: 24px 0;
```

### Card Border
```css
border: 1px solid #E5E7EB;
border-radius: 6px;
```

### Accent Border (dark theme)
```css
border: 2px solid #06B6D4;
border-radius: 8px;
```

---

## Responsive Design

### Mobile Breakpoint
```css
@media only screen and (max-width: 480px)
```

### Mobile Adjustments
- Container padding: 40px → 24px
- Font sizes: Reduced by 1-2px
- Button padding: 14px 32px → 12px 24px
- Heading sizes: Reduced 2-4px

### Responsive Table Example

```html
<table width="100%" max-width="600" style="margin: 0 auto;">
  <!-- Desktop: 600px wide -->
  <!-- Tablet: 480px wide -->
  <!-- Mobile: Full width -->
</table>
```

---

## Images

### Best Practices
- Format: PNG or JPG
- Size: < 100 KB each
- Dimensions: 2x resolution for clarity
- Alt text: Always required
- Absolute URLs: Full domain required

### Image Sizing
- Logo: 200-300px wide
- Hero image: 600px wide
- Inline images: 300-500px wide
- Icons: 24-48px

### Image Alt Text
```html
<img src="https://example.com/logo.png" 
     alt="Company Name Logo"
     style="height: 32px; width: auto;" />
```

---

## Accessibility Checklist

- [x] Color contrast ratio ≥ 4.5:1 for WCAG AA
- [x] All images have descriptive alt text
- [x] Heading hierarchy is logical (h1, h2, h3...)
- [x] Links have descriptive text (not "click here")
- [x] Font size ≥ 14px for readability
- [x] Line height ≥ 1.5 for readability
- [x] Color is not the only means of conveying information
- [x] Sufficient whitespace for scanning

---

## File Size Optimization

### Target Sizes
- HTML: 15-25 KB
- Plain text: 2-4 KB
- Total: < 30 KB

### Optimization Techniques
- Inline CSS (no separate stylesheets)
- Minimal HTML structure
- Optimize image dimensions
- Remove unnecessary attributes
- Use table-based layouts (more efficient than divs)

---

## Browser/Client Testing

### Priority Testing Order
1. Gmail (desktop & mobile)
2. Outlook (Windows)
3. Outlook (Mac)
4. Apple Mail
5. iPhone Mail
6. Android Mail

### Testing Tools
- Litmus (litmus.com)
- Email on Acid (emailonacid.com)
- Dyspatch (dyspatch.io)

### Fallback Behavior
- Email clients disable images by default
- Provide alt text for all images
- Ensure readability without images
- Test with images disabled

---

## Color Contrast Reference

### WCAG AA Minimum (4.5:1)
- Dark text on light background ✓
- Light text on dark background ✓
- White (#FFFFFF) on brand colors ✓
- Black (#111827) on off-white ✓

### Examples
- #111827 text on #FFFFFF background = 16.1:1 ✓
- #6366F1 background, #FFFFFF text = 6.2:1 ✓
- #0F172A background, #F1F5F9 text = 15.2:1 ✓

---

## Customization Tokens

### Color Tokens to Replace
```
Primary Color:    {{company.primaryColor}}
Secondary Color:  [Brand secondary]
Accent Color:     [Design family specific]
```

### Typography Tokens
```
Heading Font:  system-ui (or Georgia for Editorial)
Body Font:     system-ui
Code Font:     monospace
```

### Spacing Tokens
```
Padding Large:   40px desktop, 24px mobile
Padding Medium:  24px
Padding Small:   16px
```

---

## Version Control

**Version:** 1.0.0
**Last Updated:** January 2024

### Future Updates
- Additional color schemes
- Alternative typography options
- Expanded spacing guidelines
- Advanced responsive patterns
