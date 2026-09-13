# MAILIX Email Templates - Implementation Guide

Step-by-step instructions for integrating MAILIX email templates into your application.

## Quick Start (5 minutes)

### 1. Get a Template
```bash
# Find a template in templates/ folder
# Example: templates/authentication/email-verification/template.html
cat templates/authentication/email-verification/template.html
```

### 2. Copy the HTML
```bash
# Copy template.html content to your email system
cp templates/authentication/email-verification/template.html my-email-template.html
```

### 3. Replace Variables
```bash
# In my-email-template.html, replace:
# {{company.name}} → Your Company
# {{user.firstName}} → recipient name
# {{company.primaryColor}} → #your-color
# ... all other variables
```

### 4. Send
```bash
# Send email using your email service provider
# Use the customized HTML as the email body
```

---

## Detailed Integration by Platform

### Node.js / Express

```javascript
// 1. Load template
const fs = require('fs');
const template = fs.readFileSync('./templates/authentication/email-verification/template.html', 'utf8');

// 2. Create variables object
const variables = {
  company: {
    name: 'Acme Corp',
    logoUrl: 'https://example.com/logo.png',
    primaryColor: '#6366F1',
    website: 'https://example.com',
    supportEmail: 'support@example.com'
  },
  user: {
    firstName: 'John'
  },
  verification: {
    url: 'https://example.com/verify?token=abc123',
    expiresIn: '2 hours'
  },
  unsubscribe: {
    url: 'https://example.com/unsubscribe?email=john@example.com'
  },
  preferences: {
    url: 'https://example.com/preferences'
  }
};

// 3. Simple string replacement
function renderTemplate(template, variables) {
  let html = template;
  
  function replaceNested(str, obj, prefix = '') {
    for (const key in obj) {
      const value = obj[key];
      const placeholder = prefix ? `{{${prefix}.${key}}}` : `{{${key}}}`;
      
      if (typeof value === 'object') {
        str = replaceNested(str, value, prefix ? `${prefix}.${key}` : key);
      } else {
        str = str.replace(new RegExp(placeholder, 'g'), value);
      }
    }
    return str;
  }
  
  return replaceNested(html, variables);
}

const html = renderTemplate(template, variables);

// 4. Send with Nodemailer
const nodemailer = require('nodemailer');
const transporter = nodemailer.createTransport({...});

await transporter.sendMail({
  from: 'noreply@example.com',
  to: 'john@example.com',
  subject: 'Verify your email address',
  html: html,
  text: fs.readFileSync('./templates/authentication/email-verification/template.txt', 'utf8')
});
```

### Python / Flask

```python
from flask import render_template_string
import os

# 1. Load template
with open('templates/authentication/email-verification/template.html', 'r') as f:
    template = f.read()

# 2. Create variables
variables = {
    'company': {
        'name': 'Acme Corp',
        'logoUrl': 'https://example.com/logo.png',
        'primaryColor': '#6366F1',
        'website': 'https://example.com',
        'supportEmail': 'support@example.com'
    },
    'user': {
        'firstName': 'John'
    },
    'verification': {
        'url': 'https://example.com/verify?token=abc123',
        'expiresIn': '2 hours'
    },
    'unsubscribe': {
        'url': 'https://example.com/unsubscribe?email=john@example.com'
    },
    'preferences': {
        'url': 'https://example.com/preferences'
    }
}

# 3. Use Jinja2 template syntax
html = render_template_string(template, **variables)

# 4. Send with Flask-Mail
from flask_mail import Mail, Message

mail = Mail()
msg = Message(
    subject='Verify your email address',
    recipients=['john@example.com'],
    html=html,
    body=render_template_string(text_template, **variables)
)
mail.send(msg)
```

### Ruby / Rails

```ruby
# config/initializers/email_templates.rb
class EmailTemplates
  TEMPLATES_PATH = Rails.root.join('templates')
  
  def self.render(template_name, variables = {})
    template_path = TEMPLATES_PATH.join("#{template_name}.html")
    template = File.read(template_path)
    
    render_template(template, variables)
  end
  
  def self.render_template(template, variables)
    variables.each do |key, value|
      if value.is_a?(Hash)
        value.each do |subkey, subvalue|
          placeholder = "{{#{key}.#{subkey}}}"
          template.gsub!(placeholder, subvalue.to_s)
        end
      else
        placeholder = "{{#{key}}}"
        template.gsub!(placeholder, value.to_s)
      end
    end
    template
  end
end

# In your mailer
class UserMailer < ApplicationMailer
  def verify_email(user, token)
    variables = {
      company: {
        name: 'Acme Corp',
        logo_url: 'https://example.com/logo.png',
        primary_color: '#6366F1',
        website: 'https://example.com',
        support_email: 'support@example.com'
      },
      user: {
        first_name: user.first_name
      },
      verification: {
        url: verify_url(token),
        expires_in: '2 hours'
      },
      unsubscribe: {
        url: unsubscribe_url
      },
      preferences: {
        url: preferences_url
      }
    }
    
    html = EmailTemplates.render('authentication/email-verification', variables)
    
    mail(
      to: user.email,
      subject: 'Verify your email address',
      body: html,
      content_type: 'text/html'
    )
  end
end
```

### PHP / Laravel

```php
// app/Mail/VerifyEmail.php
<?php

namespace App\Mail;

use Illuminate\Mail\Mailable;

class VerifyEmail extends Mailable
{
    public function build()
    {
        $template = file_get_contents(
            resource_path('templates/authentication/email-verification/template.html')
        );
        
        $variables = [
            'company' => [
                'name' => 'Acme Corp',
                'logoUrl' => 'https://example.com/logo.png',
                'primaryColor' => '#6366F1',
                'website' => 'https://example.com',
                'supportEmail' => 'support@example.com'
            ],
            'user' => [
                'firstName' => $this->user->first_name
            ],
            'verification' => [
                'url' => url('/verify?token=' . $this->token),
                'expiresIn' => '2 hours'
            ],
            'unsubscribe' => [
                'url' => url('/unsubscribe')
            ],
            'preferences' => [
                'url' => url('/preferences')
            ]
        ];
        
        $html = $this->renderTemplate($template, $variables);
        
        return $this->view('emails.raw')
                    ->with('content', $html);
    }
    
    private function renderTemplate($template, $variables)
    {
        foreach ($variables as $key => $value) {
            if (is_array($value)) {
                foreach ($value as $subkey => $subvalue) {
                    $placeholder = "{{$key.$subkey}}";
                    $template = str_replace($placeholder, $subvalue, $template);
                }
            } else {
                $placeholder = "{{$key}}";
                $template = str_replace($placeholder, $value, $template);
            }
        }
        return $template;
    }
}

// In your controller
Mail::send(new VerifyEmail($user, $token));
```

### Sendgrid API

```javascript
const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

// Load template
const template = require('./templates/authentication/email-verification/template.html');

// Create message
const msg = {
  to: 'john@example.com',
  from: 'noreply@example.com',
  subject: 'Verify your email address',
  html: template
    .replace(/\{\{company.name\}\}/g, 'Acme Corp')
    .replace(/\{\{company.logoUrl\}\}/g, 'https://example.com/logo.png')
    .replace(/\{\{company.primaryColor\}\}/g, '#6366F1')
    .replace(/\{\{user.firstName\}\}/g, 'John')
    .replace(/\{\{verification.url\}\}/g, 'https://example.com/verify?token=abc123')
    .replace(/\{\{verification.expiresIn\}\}/g, '2 hours'),
  text: '...' // include plain text version
};

await sgMail.send(msg);
```

### Postmark API

```javascript
const postmark = require("postmark");
const client = new postmark.ServerClient("POSTMARK_API_TOKEN");

// Load template
const template = require('./templates/authentication/email-verification/template.html');

// Create message
const message = {
  "From": "noreply@example.com",
  "To": "john@example.com",
  "Subject": "Verify your email address",
  "HtmlBody": template
    .replace(/\{\{company.name\}\}/g, 'Acme Corp')
    .replace(/\{\{company.logoUrl\}\}/g, 'https://example.com/logo.png')
    // ... replace all variables
  "TextBody": "..." // plain text version
};

const response = await client.sendEmail(message);
```

### AWS SES (Simple Email Service)

```javascript
const AWS = require('aws-sdk');
const fs = require('fs');

const ses = new AWS.SES({ region: 'us-east-1' });

// Load template
const template = fs.readFileSync(
  './templates/authentication/email-verification/template.html', 
  'utf8'
);

// Render template
const html = template
  .replace(/\{\{company.name\}\}/g, 'Acme Corp')
  .replace(/\{\{company.logoUrl\}\}/g, 'https://example.com/logo.png')
  // ... replace all variables

const params = {
  Source: 'noreply@example.com',
  Destination: {
    ToAddresses: ['john@example.com']
  },
  Message: {
    Subject: {
      Data: 'Verify your email address'
    },
    Body: {
      Html: {
        Data: html
      },
      Text: {
        Data: '...' // plain text version
      }
    }
  }
};

await ses.sendEmail(params).promise();
```

### Mailchimp

1. Log in to Mailchimp
2. Go to Templates → Create Template
3. Choose "Code your own"
4. Paste template HTML
5. Save template
6. Create campaign using your template

### Custom Email System

```
// Generic template rendering function
function renderEmail(templateName, variables) {
  // 1. Load template file
  const template = loadTemplate(templateName);
  
  // 2. Replace all variables
  const rendered = replaceVariables(template, variables);
  
  // 3. Return rendered HTML
  return rendered;
}

// Implementation:
function replaceVariables(html, variables) {
  let result = html;
  
  for (const [key, value] of Object.entries(variables)) {
    if (typeof value === 'object') {
      // Handle nested objects like company.name
      for (const [subkey, subvalue] of Object.entries(value)) {
        const placeholder = `{{${key}.${subkey}}}`;
        result = result.replace(new RegExp(placeholder, 'g'), subvalue);
      }
    } else {
      const placeholder = `{{${key}}}`;
      result = result.replace(new RegExp(placeholder, 'g'), value);
    }
  }
  
  return result;
}
```

---

## Testing Templates

### Email Client Testing

#### Gmail
1. Send yourself a test email
2. View in browser preview
3. Check mobile and desktop views
4. Inspect images rendering
5. Test link functionality

#### Outlook
1. Use Microsoft Outlook for desktop
2. Test on Outlook for Mac
3. Check rendering in web (outlook.com)
4. Verify table layouts
5. Test email signature interference

#### Apple Mail
1. Use Apple Mail on Mac
2. Test on iPhone Mail
3. Verify responsive design
4. Check image rendering

### Automated Testing Tools
- Litmus (litmus.com) - Best for rendering tests
- Email on Acid (emailonacid.com) - Good for preview
- Dyspatch (dyspatch.io) - Visual editor and testing
- MJML (mjml.io) - Framework for responsive emails

### Checklist Before Production

```
Template Testing Checklist
─────────────────────────────────────

Rendering
☐ Renders correctly in Gmail
☐ Renders correctly in Outlook (Windows)
☐ Renders correctly in Outlook (Mac)
☐ Renders correctly in Apple Mail
☐ Renders correctly on iPhone Mail
☐ Renders correctly on Android Mail

Responsive Design
☐ Full width (600px) looks good
☐ Mobile (400px) looks good
☐ Text is readable at all sizes
☐ Images scale properly
☐ Buttons are touch-friendly

Functionality
☐ All links work (not broken)
☐ CTA buttons are clickable
☐ Unsubscribe link works
☐ Variables replaced correctly
☐ Plain text version readable

Accessibility
☐ Good color contrast
☐ All images have alt text
☐ Heading hierarchy is logical
☐ Links have descriptive text

Compliance
☐ Unsubscribe footer present
☐ Company info included
☐ Privacy policy link available
☐ CAN-SPAM compliant (US)
☐ GDPR compliant (EU)
☐ CASL compliant (Canada)
```

---

## Customization Tips

### Change Primary Color
```html
<!-- Find all instances of: -->
style="background-color: {{company.primaryColor}}"

<!-- Replace with your hex value: -->
style="background-color: #6366F1"
```

### Modify Company Name & Logo
```html
<!-- Logo: -->
<img src="{{company.logoUrl}}" alt="{{company.name}}" />

<!-- Replace with: -->
<img src="https://example.com/logo.png" alt="Acme Corp" />

<!-- Company name: -->
{{company.name}}

<!-- Replace with: -->
Acme Corp
```

### Add Custom Content Sections
1. Keep structure intact
2. Add new table rows with proper `<td>` styling
3. Maintain responsive design
4. Test in multiple clients

### Modify Typography
```html
<!-- Heading size: -->
<h1 style="font-size: 24px;">

<!-- Change to: -->
<h1 style="font-size: 28px;">

<!-- Font family (stick to system fonts): -->
font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
```

---

## Troubleshooting

### Template rendering issues?

**Problem:** Template looks broken in Outlook
- **Solution:** Check that all CSS is inline. Outlook doesn't support `<style>` tags. Verify table structure is correct.

**Problem:** Variables not replacing
- **Solution:** Check syntax: `{{variable}}` must match exactly. Ensure regex replacement is case-sensitive.

**Problem:** Mobile layout broken
- **Solution:** Verify media queries are present. Check max-width container. Test on real devices.

**Problem:** Images not showing
- **Solution:** Ensure absolute URLs (full domain). Check image hosts allow email display. Provide descriptive alt text.

**Problem:** Buttons not clickable
- **Solution:** Ensure `<a>` tags have href. Add fallback text. Test in multiple clients.

### Performance issues?

- Minimize file size (< 25 KB HTML)
- Optimize images (< 100 KB each)
- Remove unnecessary CSS
- Compress template files

### Rendering differences?

- Email clients render differently - this is normal
- Test in Litmus/Email on Acid for accurate previews
- Use fallback styling for compatibility
- Maintain progressive enhancement approach

---

## Version Control

### Track Template Changes
```bash
# In your git repo
/templates/                    # Template files
  /authentication/
    /email-verification/
      - template.html         # Version controlled
      - template.txt
      - metadata.json

# Don't version control:
# - Rendered/compiled versions
# - Test emails
# - Local customizations
```

### Create Template Variants
```
/templates/
  /authentication/
    /email-verification/
      /template.html           # Original
      /template-dark.html      # Dark theme variant
      /template-minimal.html   # Minimal variant
```

---

## Best Practices

1. **Always include both HTML and plain text versions**
   - Not all email clients support HTML
   - Plain text version for accessibility
   - Both included in this library

2. **Test before sending**
   - Test in multiple clients
   - Test on real devices
   - Use Litmus/Email on Acid
   - Send test emails to yourself

3. **Keep variables consistent**
   - Use same naming across projects
   - Document variable requirements
   - Validate before rendering

4. **Monitor performance**
   - Track email open rates
   - Monitor click-through rates
   - A/B test subject lines
   - Iterate based on metrics

5. **Maintain templates**
   - Keep backup copies
   - Document customizations
   - Version control changes
   - Update when brand changes

---

## Further Resources

- [Email on Acid - Best Practices](https://www.emailonacid.com/)
- [Litmus - Email Template Guide](https://www.litmus.com/)
- [MJML - Responsive Email Framework](https://mjml.io/)
- [Can I Email - CSS Support](https://www.campaignmonitor.com/css/)
- [Email Markup](https://emailmarkup.org/)

---

**Last Updated:** January 2024
**Version:** 1.0.0
