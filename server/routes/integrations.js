/**
 * Code Generator / Integrations
 *
 * Generates language-specific integration snippets for the customer's
 * project and API configuration. Never exposes secret keys in
 * frontend/browser-targeted snippets.
 */

const express = require('express');
const router = express.Router();
const { config } = require('../config');
const { requireAuth, requireRole, ROLES } = require('../utils/auth');

const LANGUAGES = ['javascript', 'typescript', 'python', 'php', 'java', 'csharp', 'go', 'ruby', 'curl'];
const TYPES = ['email-send', 'verification', 'password-reset', 'newsletter'];

/**
 * Frontend-targeted languages (cannot safely include secret keys).
 */
const FRONTEND_LANGUAGES = new Set(['javascript', 'typescript']);

function generateSnippet(language, type, options) {
  const { baseUrl, projectId, publishableKey } = options;
  const url = `${baseUrl}/api/v1`;

  if (language === 'curl') {
    if (type === 'email-send') {
      return `curl -X POST ${url}/emails/send \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '${JSON.stringify({ to: 'user@example.com', subject: 'Hi', html: '<p>Hello</p>' }, null, 2)}'`;
    }
    if (type === 'verification') {
      return `curl -X POST ${url}/verification/send \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{"email":"user@example.com"}'`;
    }
    if (type === 'password-reset') {
      return `curl -X POST ${url}/password-reset/request \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{"email":"user@example.com"}'`;
    }
    if (type === 'newsletter') {
      return `curl -X POST ${url}/newsletter/campaigns \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{"name":"Welcome","subject":"Welcome!","fromName":"Acme","fromEmail":"hello@acme.com","template":"welcome"}'`;
    }
  }

  if (language === 'javascript' || language === 'typescript') {
    const usePublishable = FRONTEND_LANGUAGES.has(language);
    const authLine = usePublishable
      ? `// Browser-safe: include your publishable key here\nconst apiKey = 'pk_live_...'; // public key only\nconst headers = { 'Authorization': \`Bearer \${apiKey}\`, 'X-Project': '${projectId}' };`
      : `// Server-side: full API key\nconst apiKey = process.env.MAILIX_API_KEY;\nconst headers = { 'Authorization': \`Bearer \${apiKey}\` };`;
    const ts = language === 'typescript' ? ': Promise<any>' : '';
    if (type === 'email-send') {
      return `${language === 'typescript' ? 'async function' : 'async function'} sendEmail(to, subject, html)${ts} {
  const res = await fetch('${url}/emails/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ to, subject, html, projectId: '${projectId}' }),
  });
  return res.json();
}`;
    }
    if (type === 'verification') {
      return `${language === 'typescript' ? 'async function' : 'async function'} sendVerification(email)${ts} {
  const res = await fetch('${url}/verification/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ email, projectId: '${projectId}' }),
  });
  return res.json();
}`;
    }
    if (type === 'password-reset') {
      return `${language === 'typescript' ? 'async function' : 'async function'} requestPasswordReset(email)${ts} {
  const res = await fetch('${url}/password-reset/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ email, projectId: '${projectId}' }),
  });
  return res.json();
}`;
    }
    if (type === 'newsletter') {
      return `${language === 'typescript' ? 'async function' : 'async function'} createCampaign(campaign)${ts} {
  const res = await fetch('${url}/newsletter/campaigns', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify({ ...campaign, projectId: '${projectId}' }),
  });
  return res.json();
}`;
    }
  }

  if (language === 'python') {
    return `import os, requests

API_KEY = os.environ['MAILIX_API_KEY']
BASE = '${url}'

def ${type === 'email-send' ? 'send_email' : type === 'verification' ? 'send_verification' : type === 'password-reset' ? 'request_password_reset' : 'create_campaign'}(${type === 'email-send' ? 'to, subject, html' : 'data'}):
    return requests.post(
        f'{BASE}/${type.replace("-", "/")}${type === 'email-send' ? '' : type === 'verification' ? '/send' : type === 'password-reset' ? '/request' : ''}',
        headers={'Authorization': f'Bearer {API_KEY}'},
        json={'projectId': '${projectId}', ${type === 'email-send' ? 'to, subject, html' : '**data'}}
    ).json()`;
  }

  if (language === 'php') {
    return `<?php
$apiKey = getenv('MAILIX_API_KEY');
$base = '${url}';

$ch = curl_init('$base/${type.replace("-", "/")}');
curl_setopt($ch, CURLOPT_HTTPHEADER, [
    'Authorization: Bearer ' . $apiKey,
    'Content-Type: application/json',
]);
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode(['projectId' => '${projectId}']));
$response = curl_exec($ch);
curl_close($ch);
echo $response;`;
  }

  if (language === 'go') {
    return `package main

import (
    "bytes"
    "encoding/json"
    "net/http"
    "os"
)

func ${type === 'email-send' ? 'sendEmail' : 'sendMail'}() error {
    apiKey := os.Getenv("MAILIX_API_KEY")
    payload := map[string]string{"projectId": "${projectId}"}
    body, _ := json.Marshal(payload)
    req, _ := http.NewRequest("POST", "${url}/${type}", bytes.NewBuffer(body))
    req.Header.Set("Authorization", "Bearer "+apiKey)
    req.Header.Set("Content-Type", "application/json")
    resp, err := http.DefaultClient.Do(req)
    if err != nil { return err }
    defer resp.Body.Close()
    return nil
}`;
  }

  if (language === 'ruby') {
    return `require 'net/http'
require 'json'
require 'uri'

uri = URI('${url}/${type}')
http = Net::HTTP.new(uri.host, uri.port)
req = Net::HTTP::Post.new(uri.path)
req['Authorization'] = "Bearer #{ENV['MAILIX_API_KEY']}"
req['Content-Type'] = 'application/json'
req.body = { projectId: '${projectId}' }.to_json
res = http.request(req)
puts res.body`;
  }

  if (language === 'java') {
    return `import java.net.http.*;
import java.net.URI;

public class MailixClient {
    public static void main(String[] args) throws Exception {
        HttpClient client = HttpClient.newHttpClient();
        HttpRequest req = HttpRequest.newBuilder()
            .uri(URI.create("${url}/${type}"))
            .header("Authorization", "Bearer " + System.getenv("MAILIX_API_KEY"))
            .header("Content-Type", "application/json")
            .POST(HttpRequest.BodyPublishers.ofString("{\\"projectId\\":\\"${projectId}\\"}"))
            .build();
        HttpResponse<String> res = client.send(req, HttpResponse.BodyHandlers.ofString());
        System.out.println(res.body());
    }
}`;
  }

  if (language === 'csharp') {
    return `using System.Net.Http;
using System.Text;

var client = new HttpClient();
client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", System.Environment.GetEnvironmentVariable("MAILIX_API_KEY"));
var body = new StringContent("{\\"projectId\\":\\"${projectId}\\"}", Encoding.UTF8, "application/json");
var response = await client.PostAsync("${url}/${type}", body);
Console.WriteLine(await response.Content.ReadAsStringAsync());`;
  }

  return `// Language "${language}" + type "${type}" not implemented yet.`;
}

router.post('/snippet', requireAuth, requireRole(ROLES.DEVELOPER), async (req, res, next) => {
  try {
    const { language, type, projectId } = req.body;
    if (!LANGUAGES.includes(language)) {
      return res.status(400).json({ error: { code: 'INVALID_LANGUAGE', message: 'Unknown language' } });
    }
    if (!TYPES.includes(type)) {
      return res.status(400).json({ error: { code: 'INVALID_TYPE', message: 'Unknown integration type' } });
    }
    const snippet = generateSnippet(language, type, {
      baseUrl: config.server.baseUrl,
      projectId: projectId || 'YOUR_PROJECT_ID',
      publishableKey: 'pk_live_...',
    });
    res.json({ language, type, snippet });
  } catch (err) {
    next(err);
  }
});

router.get('/languages', (req, res) => {
  res.json({ languages: LANGUAGES, types: TYPES });
});

module.exports = router;
