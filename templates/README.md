# MAILIX Premium Email Templates

A production-ready collection of 40+ original, premium HTML email templates designed for modern SaaS and ecommerce platforms.

## Overview

This template library provides enterprise-grade email templates across five distinct design families, covering all major communication categories: authentication, user lifecycle, business operations, marketing, and commerce.

**Key Features:**
- ✅ 40+ production-ready templates
- ✅ 5 distinctive design families
- ✅ Fully responsive and mobile-optimized
- ✅ Email-client compatible (Gmail, Outlook, Apple Mail, iOS, Android)
- ✅ Table-based HTML for maximum compatibility
- ✅ Inline CSS with email-safe practices
- ✅ Dynamic variable system for easy customization
- ✅ Plain text versions included
- ✅ No external dependencies
- ✅ Fully original designs
- ✅ WCAG AA accessibility compliance

## Design Families

### 1. MAILIX Core
**Aesthetic:** Clean, modern, professional
- White/neutral backgrounds
- Refined accent colors
- Rounded content cards
- Minimal but premium feel
- **Best for:** Most companies, general-purpose communications

### 2. Midnight Signal
**Aesthetic:** Dark, technical, futuristic
- Deep navy/charcoal backgrounds
- Bright, tasteful accent colors
- High-contrast elements
- Premium developer-tool aesthetic
- **Best for:** Tech companies, developer platforms, security-focused brands

### 3. Editorial
**Aesthetic:** Elegant, typography-focused, sophisticated
- Large, impactful headlines
- Strong editorial spacing
- Serif typography options
- Minimal visual clutter
- **Best for:** Newsletters, announcements, thought leadership, product stories

### 4. Enterprise
**Aesthetic:** Professional B2B corporate
- Neutral color palettes
- Trustworthy visual hierarchy
- Clear information blocks
- Compliance-friendly
- **Best for:** B2B companies, corporate communications, financial services

### 5. Commerce
**Aesthetic:** Premium transactional, action-oriented
- Clean, structured layouts
- Order/invoice tables
- Status indicators
- Conversion-focused
- **Best for:** Ecommerce, subscription services, SaaS billing

## Template Categories

### Authentication & Security (10 templates)
- Email verification
- Verification code / OTP
- Password reset
- Password changed
- New login alert
- Suspicious login alert
- Two-factor authentication
- Account invitation
- Account activated
- Email address changed

### User Lifecycle (10 templates)
- Welcome email
- Getting started
- Onboarding checklist
- Trial started
- Trial ending soon
- Trial expired
- Upgrade confirmation
- Account cancellation
- Re-engagement
- Profile completion reminder

### Business & Operations (10 templates)
- Invoice
- Payment successful
- Payment failed
- Refund processed
- Subscription started
- Subscription renewed
- Subscription canceled
- Maintenance notice
- Service outage
- Support ticket created

### Marketing & Newsletter (10 templates)
- Product announcement
- Feature launch
- Company newsletter
- Weekly digest
- Monthly digest
- Event invitation
- Webinar invitation
- Product update
- Promotional campaign
- Customer announcement

### Commerce & Transactions (10 templates)
- Order confirmation
- Order shipped
- Order delivered
- Order canceled
- Receipt
- Cart reminder
- Subscription renewal
- Download available
- Product recommendation
- Delivery status update

## Folder Structure

```
mailix-email-templates/
├── README.md                          # This file
├── IMPLEMENTATION.md                  # Integration guide
├── template-catalog.json              # Complete template metadata
├── DESIGN-SYSTEM.md                   # Design specifications
│
├── assets/
│   ├── README.md
│   └── [color-palettes, design-tokens]
│
├── templates/
│   ├── authentication/
│   │   ├── email-verification/
│   │   │   ├── template.html
│   │   │   ├── template.txt
│   │   │   └── metadata.json
│   │   ├── verification-code/
│   │   └── [... other templates]
│   │
│   ├── lifecycle/
│   │   ├── welcome-email/
│   │   └── [... other templates]
│   │
│   ├── business/
│   │   ├── invoice/
│   │   └── [... other templates]
│   │
│   ├── marketing/
│   │   └── [... other templates]
│   │
│   └── commerce/
│       ├── order-confirmation/
│       └── [... other templates]
│
├── previews/
│   ├── README.md
│   └── [Preview information]
│
└── plain-text/
    └── [Plain text versions]
```

## Dynamic Variables

All templates use a consistent variable syntax for easy customization:

### Company Variables
```
{{company.name}}           # "Acme Corp"
{{company.logoUrl}}        # Logo image URL
{{company.website}}        # www.example.com
{{company.primaryColor}}   # #6366F1
{{company.supportEmail}}   # support@example.com
{{company.address}}        # Company address
```

### User Variables
```
{{user.name}}              # Full name
{{user.firstName}}         # First name
{{user.email}}             # Email address
```

### Verification Variables
```
{{verification.code}}      # "123456"
{{verification.url}}       # Verification link
{{verification.expiresIn}} # "2 hours"
```

### Order Variables
```
{{order.id}}               # Order number
{{order.number}}           # #ORD-12345
{{order.date}}             # Date ordered
{{order.items}}            # Line items
{{order.total}}            # Total amount
{{order.currency}}         # USD
{{order.estimatedDelivery}}# Expected delivery date
```

### Invoice Variables
```
{{invoice.number}}         # Invoice number
{{invoice.date}}           # Invoice date
{{invoice.dueDate}}        # Payment due date
{{invoice.items}}          # Line items
{{invoice.subtotal}}       # Subtotal
{{invoice.tax}}            # Tax amount
{{invoice.amount}}         # Total amount
{{invoice.currency}}       # USD
```

### Subscription Variables
```
{{subscription.name}}      # Plan name
{{subscription.price}}     # Price per cycle
{{subscription.billingCycle}} # Monthly/Yearly
{{subscription.renewalDate}} # Next renewal
```

### Event Variables
```
{{event.name}}             # Event name
{{event.type}}             # Event type
{{event.date}}             # Event date
{{event.time}}             # Event time
{{event.location}}         # Event location
{{event.url}}              # Event page URL
```

### Engagement Variables
```
{{unsubscribe.url}}        # Unsubscribe link
{{preferences.url}}        # Email preferences
{{tracking.url}}           # Order tracking
{{review.url}}             # Review link
```

## Email Client Compatibility

All templates are tested and optimized for:

| Client | Desktop | Mobile | Notes |
|--------|---------|--------|-------|
| Gmail | ✅ | ✅ | Full support |
| Outlook (Windows) | ✅ | ✅ | Table-based layouts for compatibility |
| Outlook (Mac) | ✅ | ✅ | Full support |
| Apple Mail | ✅ | ✅ | Full support |
| iOS Mail | ✅ | ✅ | Responsive design optimized |
| Android Mail | ✅ | ✅ | Full support |

**Compatibility Notes:**
- All templates use table-based layouts for maximum compatibility
- Inline CSS only (no `<style>` tags)
- Minimal margin/padding attributes due to Outlook limitations
- Media queries for responsive behavior
- Fallback fonts: System fonts only, no web fonts
- Button fallbacks for email clients with limited support

## Technical Specifications

### HTML & CSS
- **Structure:** Table-based for email compatibility
- **CSS:** Inline only, email-safe practices
- **Responsive:** Mobile media queries included
- **JavaScript:** None (not supported in email)
- **External Resources:** None required
- **Fonts:** System fonts only

### Accessibility
- WCAG AA color contrast compliance
- Semantic heading hierarchy
- Alt text for all images
- Descriptive link text
- Proper table structure with headers

### File Size
- Average HTML: 15-25 KB
- Plain text: 2-4 KB
- Optimized for quick loading

## Getting Started

### 1. Choose Your Template

Browse the `templates/` folder and select a template that matches your use case:
- **Authentication needs?** → `templates/authentication/`
- **Onboarding content?** → `templates/lifecycle/`
- **Transactional emails?** → `templates/business/` or `templates/commerce/`
- **Marketing campaigns?** → `templates/marketing/`

### 2. Review the Metadata

Each template includes a `metadata.json` file with:
- Template name and description
- Required and optional variables
- Design family and category
- Customization guidance

### 3. Customize Variables

Replace all `{{variable}}` placeholders with your actual values or variable references:

```html
<!-- Before -->
<h1>Welcome, {{user.firstName}}!</h1>
<img src="{{company.logoUrl}}" />

<!-- After (Static) -->
<h1>Welcome, John!</h1>
<img src="https://example.com/logo.png" />

<!-- After (Dynamic - in your email system) -->
<h1>Welcome, {firstName}!</h1>
<img src="{logoUrl}" />
```

### 4. Customize Colors

Update the primary color variable to match your brand:

```html
<!-- Find and replace: -->
background-color: {{company.primaryColor}}

<!-- With your hex color: -->
background-color: #6366F1
```

### 5. Test Before Send

- Test in multiple email clients
- Validate responsive behavior on mobile
- Check variable substitution
- Verify all links work
- Test with and without images

## Customization Guide

### Colors
All templates use CSS color values that can be customized:
- Primary color: `{{company.primaryColor}}`
- Secondary/accent colors vary by design family
- Update hex values to match your brand

### Typography
- All templates use system fonts for compatibility
- Headings: 24-48px depending on template
- Body text: 14-16px
- Line height: 1.5-1.7

### Spacing
- Use responsive padding/margin for compatibility
- Mobile breakpoint: 480px
- Generous whitespace for premium feel

### Images
- Ensure alt text for all images
- Use absolute URLs (full domain)
- Optimize image file sizes
- Test image loading in clients that block images

### Logo
- Replace `{{company.logoUrl}}` with your logo URL
- Recommended: 200-300px width
- Use PNG or JPG format
- Ensure good contrast for dark/light backgrounds

## Integration Methods

### 1. Direct HTML Embedding
Copy the HTML directly into your email system:

```html
<!-- Paste template.html content -->
<!-- Replace variables before sending -->
```

### 2. Variable-Based Integration
Use your system's variable syntax:

```html
<!-- MAILIX -->
{% if user %}
  Hello {{user.firstName}}!
{% endif %}

<!-- Liquid -->
{% if user %}
  Hello {{ user.firstName }}!
{% endif %}

<!-- Handlebars -->
Hello {{user.firstName}}!

<!-- ERB/Ruby -->
Hello <%= @user.first_name %>!

<!-- Jinja2/Python -->
Hello {{ user.first_name }}!
```

### 3. API/SDK Integration
Reference templates by slug when sending:

```javascript
// Example: SendGrid API
const msg = {
  to: 'recipient@example.com',
  from: 'noreply@example.com',
  subject: 'Verify your email',
  html: getTemplate('email-verification'),
  dynamicTemplateData: {
    user: { firstName: 'John' },
    company: { name: 'ACME Corp' },
    verification: { url: '...', expiresIn: '2 hours' }
  }
};
```

### 4. Static Site Builders
Generate email templates at build time:

```javascript
// Example: Node.js build script
const fs = require('fs');

const template = fs.readFileSync('email-verification/template.html', 'utf8');
const rendered = template
  .replace(/\{\{company.name\}\}/g, 'ACME Corp')
  .replace(/\{\{company.primaryColor\}\}/g, '#6366F1');

// Use rendered template
```

### 5. Email Service Providers
Most major ESP platforms support these templates:
- Mailchimp
- Sendgrid
- Postmark
- Brevo (Sendinblue)
- Amazon SES
- Resend
- Custom SMTP

Refer to your ESP's documentation on uploading or creating templates.

## Maintenance

### Version Updates
- Check `template-catalog.json` for version info
- Updates will be documented in release notes
- Backward compatibility maintained for major versions

### Customization Best Practices
1. Keep original templates as reference
2. Create a copy for your customizations
3. Document any color/variable changes
4. Test before deploying to production
5. Save your customized versions for future use

### Testing Checklist
- [ ] Renders correctly in Gmail
- [ ] Renders correctly in Outlook (Windows)
- [ ] Renders correctly in Outlook (Mac)
- [ ] Renders correctly in Apple Mail
- [ ] Renders correctly on iOS Mail
- [ ] Renders correctly on Android Mail
- [ ] Mobile layout looks good (< 480px width)
- [ ] All links are functional
- [ ] Variables replaced correctly
- [ ] Images load properly
- [ ] Color contrast is accessible
- [ ] No rendering errors in email client inspector

## Technical Support

### Common Issues

**Issue:** Template looks broken in Outlook
- **Solution:** Outlook has limited CSS support. Use inline styles and table layouts (which these templates already do). Test with Outlook rendering preview.

**Issue:** Images not displaying
- **Solution:** Ensure image URLs are absolute (full domain). Some email clients require opt-in for image display. Provide alt text.

**Issue:** Mobile layout looks squished
- **Solution:** Check that media queries are intact. Ensure `max-width` container is set. Test on actual mobile devices.

**Issue:** Variables not replacing
- **Solution:** Verify variable syntax matches your system's format. Check for typos in variable names. Ensure your email system processes the template before sending.

**Issue:** Button clicks not working
- **Solution:** Ensure URLs are absolute and correct. Some clients require fallback link text. Test in multiple clients.

## Licensing & Attribution

These templates are **original designs** created specifically for MAILIX. They are:

✅ **Fully original** - Not copied from any existing template library, competitor, or design platform
✅ **Custom coded** - Written from scratch with email best practices
✅ **Exclusive to MAILIX** - Not republished or resold elsewhere
✅ **Yours to customize** - Modify colors, fonts, copy, and structure as needed

### You may:
- Use these templates for your projects
- Customize the designs and copy
- Embed in your application
- Integrate with your systems
- Share templates internally with your team

### You may not:
- Redistribute the original templates without modification
- Claim authorship
- Sell the original templates to third parties
- Use as a basis for a competing template library

## Frequently Asked Questions

**Q: Can I use these templates in production?**
A: Yes, absolutely. All templates are production-ready and tested for email compatibility.

**Q: Do I need to modify these templates?**
A: At minimum, replace company variables with your actual information. Customize colors and copy to match your brand.

**Q: Are these templates responsive?**
A: Yes, all templates include mobile media queries and are optimized for screens as small as 320px wide.

**Q: What if my email system uses different variable syntax?**
A: Find and replace the `{{variable}}` syntax with your system's format (e.g., `{variable}`, `$variable`, `<%variable%>`).

**Q: Can I modify the HTML structure?**
A: Yes, feel free to modify. Just test in multiple email clients to ensure compatibility.

**Q: Which email client should I prioritize testing in?**
A: Test in Gmail, Outlook, and Apple Mail first, as they represent ~80% of email traffic.

**Q: Why are table-based layouts used?**
A: Email clients have limited CSS support. Table-based layouts are the most compatible approach.

**Q: Can I add my own images?**
A: Yes, add images using absolute URLs. Ensure alt text is provided and images are optimized.

**Q: How do I handle dark mode?**
A: Most templates work in dark mode due to system color settings. The Midnight Signal family is designed for dark mode.

**Q: What about unsubscribe links?**
A: Include `{{unsubscribe.url}}` in the footer. Many jurisdictions (CAN-SPAM, GDPR, CASL) legally require this.

## Resources

- **Template Catalog:** `template-catalog.json` - Complete metadata for all templates
- **Design System:** `DESIGN-SYSTEM.md` - Color palettes, typography, and spacing
- **Implementation Guide:** `IMPLEMENTATION.md` - Step-by-step integration instructions
- **Plain Text Versions:** `plain-text/` - Text-only versions of all templates

## Changelog

**v1.0.0 - Initial Release (2024)**
- 40+ premium templates across 5 design families
- Full email client compatibility
- Complete variable system
- Plain text versions
- Comprehensive documentation

## About MAILIX

MAILIX is a modern email infrastructure platform designed for developers, startups, and enterprises. These templates are part of MAILIX's commitment to providing production-grade email tools.

---

**Last Updated:** January 2024
**Version:** 1.0.0
**Status:** Production Ready ✅
