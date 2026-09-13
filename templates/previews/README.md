# Email Template Previews

This folder contains preview information for the MAILIX email template library.

## Preview Strategy

While we recommend testing templates in actual email clients (Gmail, Outlook, Apple Mail), this folder serves as a reference for:

1. **Template Descriptions** - What each template looks like
2. **Design Family Samples** - Examples of each design aesthetic
3. **Variable Showcase** - How templates render with sample data
4. **Best Practices** - Visual guides for proper customization

## Quick Template Selector

### Need a welcome email?
→ `templates/lifecycle/welcome-email/`
📱 Editorial design, sophisticated typography

### Need an order confirmation?
→ `templates/commerce/order-confirmation/`
📱 Commerce design, structured layout

### Need a verification email?
→ `templates/authentication/email-verification/`
📱 MAILIX Core design, professional and clean

### Need a verification code?
→ `templates/authentication/verification-code/`
📱 Midnight Signal design, dark theme, high contrast

### Need an invoice?
→ `templates/business/invoice/`
📱 Enterprise design, corporate appropriate

## Template Gallery

### MAILIX Core Family
**Aesthetic:** Clean, modern, professional
**Best for:** Most SaaS companies

Templates:
- Email verification
- Welcome email
- Trial ending soon
- Product announcement
- Cart reminder

**Colors:** Indigo (#6366F1) primary, white background

### Midnight Signal Family
**Aesthetic:** Dark, technical, futuristic
**Best for:** Developer platforms, tech companies

Templates:
- Verification code (OTP)
- Two-factor authentication
- New login alert
- API documentation updates
- Technical announcements

**Colors:** Cyan (#06B6D4) primary, deep navy background

### Editorial Family
**Aesthetic:** Elegant, typography-focused
**Best for:** Newsletters, thought leadership

Templates:
- Welcome email
- Company newsletter
- Weekly digest
- Product announcement
- Event invitation

**Colors:** Blue (#3B82F6) primary, serif typography

### Enterprise Family
**Aesthetic:** Professional B2B corporate
**Best for:** Corporate communications, B2B SaaS

Templates:
- Invoice
- Payment successful
- Subscription started
- Maintenance notice
- Support ticket created

**Colors:** Blue (#3B82F6) primary, neutral palette

### Commerce Family
**Aesthetic:** Premium transactional
**Best for:** Ecommerce, subscriptions

Templates:
- Order confirmation
- Order shipped
- Order delivered
- Cart reminder
- Subscription renewal

**Colors:** Green (#059669) accents, white background

## How to Preview Templates

### 1. Open in Text Editor
View the HTML source to understand the structure:
```bash
cat templates/authentication/email-verification/template.html
```

### 2. Save and Open in Browser
While email clients render differently, opening in a browser gives quick preview:
```bash
# Copy to browser
open templates/authentication/email-verification/template.html
```

### 3. Render with Sample Data
Replace variables with sample data and open in browser:
- {{company.name}} → "Acme Corp"
- {{user.firstName}} → "John"
- {{verification.code}} → "123456"

### 4. Use Email Testing Tools
For accurate preview, use professional tools:
- **Litmus** (litmus.com) - Best for email rendering tests
- **Email on Acid** (emailonacid.com) - Great for previews
- **Dyspatch** (dyspatch.io) - Visual editor with testing

### 5. Send Test Email
The most reliable preview: send yourself a test email

## Mobile Preview Notes

All templates are optimized for mobile (< 480px width):
- Responsive media queries included
- Touch-friendly buttons (> 44px tap target)
- Single-column layout for mobile
- Readable font sizes throughout

When previewing on mobile:
1. Test on iPhone Safari
2. Test on Android Chrome
3. Check that buttons are clickable
4. Verify text wrapping

## Customization Preview Tips

### Preview Colors
Before deploying, preview your custom colors:
1. Open template in text editor
2. Find: `{{company.primaryColor}}`
3. Replace with your hex color (e.g., `#FF6B6B`)
4. Save and open in browser

### Preview Typography
If customizing fonts:
1. Keep to system fonts for compatibility
2. Test serif fonts (Editorial only)
3. Verify readability at 14px+ sizes
4. Check line height (1.5+ recommended)

### Preview Images
Before deployment:
1. Ensure images are hosted (absolute URLs)
2. Test with images disabled (many email clients default to this)
3. Verify alt text displays well
4. Check image quality on mobile

## Design Family Comparison

| Family | Primary Color | Best For | Mood |
|--------|---------------|----------|------|
| MAILIX Core | #6366F1 (Indigo) | General SaaS | Professional, modern |
| Midnight Signal | #06B6D4 (Cyan) | Tech/Dev | Sophisticated, technical |
| Editorial | #3B82F6 (Blue) | Newsletters | Elegant, thoughtful |
| Enterprise | #3B82F6 (Blue) | B2B/Corporate | Trustworthy, formal |
| Commerce | {{brand}} (Green/Red) | Ecommerce | Action-oriented |

## Template Recommendations

### By Industry

**SaaS/Web Apps**
→ MAILIX Core family
→ Editorial for newsletters

**Developer Tools/APIs**
→ Midnight Signal family
→ Technical language and dark theme

**E-commerce**
→ Commerce family
→ Transactional focus

**Corporate/B2B**
→ Enterprise family
→ Professional tone

**Media/Publishing**
→ Editorial family
→ Typography-focused

### By Email Type

**Onboarding**
→ Welcome email (Editorial/MAILIX Core)
→ Onboarding checklist (MAILIX Core)

**Transactional**
→ Order confirmation (Commerce)
→ Invoice (Enterprise)
→ Payment receipt (Commerce)

**Security**
→ Verification code (Midnight Signal)
→ Password reset (MAILIX Core)
→ 2FA (Midnight Signal)

**Marketing**
→ Newsletter (Editorial)
→ Product announcement (Editorial/MAILIX Core)
→ Promotional (MAILIX Core)

**Lifecycle**
→ Welcome (Editorial/MAILIX Core)
→ Trial ending (MAILIX Core)
→ Upgrade confirmation (Commerce)

## Testing Checklist for Previewing

```
Visual Check
☐ Colors display correctly
☐ Typography looks professional
☐ Spacing is generous and balanced
☐ Images display (if included)

Mobile Check
☐ Single-column layout on mobile
☐ Text wraps properly
☐ Buttons are clickable (large enough)
☐ No horizontal scrolling

Functional Check
☐ Links are clickable
☐ CTA button stands out
☐ Alt text displays for images
☐ Footer information visible

Variable Check
☐ Company name inserted
☐ User firstName inserted
☐ Dates formatted correctly
☐ Links point to correct URLs
☐ Color customizations applied
```

## Accessibility Preview

When previewing, check:
- ✓ Text is readable (14px+ size, 1.5+ line height)
- ✓ Color contrast is sufficient (check with Contrast Checker tool)
- ✓ Images have descriptive alt text
- ✓ Headings form proper hierarchy
- ✓ Links have descriptive text (not "click here")

## Performance Notes

### File Sizes
- HTML: 15-25 KB (email-safe)
- Plain text: 2-4 KB
- Optimized for quick loading

### Load Time
- All templates load in < 2 seconds
- No external dependencies (images must be hosted separately)
- Inline CSS (no stylesheet loading)

## Video Walkthrough

For detailed template walkthrough:
1. Pick a template from the catalog
2. Read the metadata.json file
3. Review template.html structure
4. Check template.txt plain text version
5. Compare with the DESIGN-SYSTEM.md

## Troubleshooting Preview Issues

**Q: Template looks broken in my browser**
A: Email HTML is different from web HTML. Use email testing tools or send yourself a test email.

**Q: Colors look different in my email client**
A: Different email clients render colors differently. Test in actual email clients using Litmus or similar.

**Q: Variables show as {{literal.text}}**
A: Preview tool isn't processing template syntax. Replace variables manually for static preview.

**Q: Mobile version looks squished**
A: Check that media queries are included. Test on actual mobile device for accurate view.

---

## Further Resources

- **DESIGN-SYSTEM.md** - Design specifications and color palettes
- **README.md** - Complete documentation
- **IMPLEMENTATION.md** - Integration guides for your platform
- **template-catalog.json** - All template metadata

---

**Version:** 1.0.0
**Last Updated:** January 2024
