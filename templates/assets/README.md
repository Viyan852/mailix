# Assets

This folder contains design system assets and reference files for MAILIX email templates.

## Contents

### Color Palettes
Design token files for each template family:
- `mailix-core-colors.txt` - Color values for MAILIX Core family
- `midnight-signal-colors.txt` - Color values for Midnight Signal family
- `editorial-colors.txt` - Color values for Editorial family
- `enterprise-colors.txt` - Color values for Enterprise family
- `commerce-colors.txt` - Color values for Commerce family

### Typography
- `fonts-reference.txt` - Font specifications and system font stacks
- `font-sizes.txt` - Font size scale and usage guidelines

### Spacing
- `spacing-scale.txt` - Complete spacing system reference
- `padding-guidelines.txt` - Padding guidelines by element type

### Design Tokens
- `design-tokens.json` - Machine-readable design tokens
- `css-variables.css` - CSS variable definitions (reference only)

## Using Design Assets

### 1. Color Palettes
Each color palette file contains hex values for all design families:

```
MAILIX Core Primary: #6366F1
MAILIX Core Background: #F9FAFB
...
```

Use these values to:
- Customize template colors
- Maintain brand consistency
- Generate new color variants

### 2. Typography Reference
Check typography files for:
- System font stack specification
- Font size scale
- Line height recommendations
- Weight values for different text types

### 3. Spacing System
Use spacing scale for:
- Consistent padding/margins
- Mobile breakpoint adjustments
- Responsive layout guidelines

### 4. Design Tokens
Machine-readable tokens for:
- Automated template generation
- Design system integration
- Build pipeline customization

## Color System Reference

### MAILIX Core
- Primary: #6366F1
- Background: #F9FAFB
- Text: #111827
- Border: #E5E7EB

### Midnight Signal
- Primary: #06B6D4
- Background: #0F172A
- Text: #F1F5F9
- Border: #334155

### Editorial
- Primary: #3B82F6
- Background: #FAFAFA
- Text: #111827
- Border: #E5E7EB

### Enterprise
- Primary: #3B82F6
- Background: #F3F4F6
- Text: #1F2937
- Border: #E5E7EB

### Commerce
- Primary: {{company.primaryColor}}
- Background: #F8FAFB
- Text: #111827
- Border: #E5E7EB

## Typography Stack

```
System UI: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Helvetica Neue', sans-serif
Serif: Georgia, 'Times New Roman', serif
Monospace: monospace
```

## Spacing Scale

4px → 8px → 12px → 16px → 20px → 24px → 28px → 32px → 40px → 48px → 60px

## Integration

### With Design Tools
Import color palettes into Figma, Adobe XD, or Sketch for mockups.

### With Development
Use design tokens in CSS preprocessing systems:
- SASS variables
- CSS custom properties
- Design token generators

### With Email Systems
Reference this folder when customizing templates to ensure consistency.

## Updates

As the design system evolves, files in this folder will be updated accordingly. Version numbers are maintained in `template-catalog.json`.

---

**Version:** 1.0.0
**Last Updated:** January 2024
