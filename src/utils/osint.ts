// OSINT utilities using public, keyless endpoints only
// All requests are client-side and respect CORS. No API keys required.

export type RiskLevel = 'low' | 'medium' | 'high';

export interface IPLookup {
  ip?: string;
  city?: string;
  region?: string;
  country?: string;
  lat?: number;
  lon?: number;
  isp?: string;
  org?: string;
  asn?: string;
  reverse?: string;
  timezone?: string;
  proxy?: boolean;
  hosting?: boolean;
  sources: Record<string, any>;
}

export interface DomainLookup {
  domain: string;
  a?: string[];
  aaaa?: string[];
  mx?: { priority: number; exchange: string }[];
  ns?: string[];
  txt?: string[];
  dmarc?: string | null;
  spf?: boolean;
  rdap?: any | null;
}

export interface EmailLookup {
  email: string;
  domain: string;
  hasMX: boolean;
  hasSPF: boolean;
  hasDMARC: boolean;
  dmarcPolicy: string | null;
  txtSamples?: string[];
}

export interface UsernameProfile {
  platform: string;
  exists: boolean;
  url: string;
  data?: any;
}

async function fetchJSON(url: string, init?: RequestInit) {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`Request failed: ${res.status} ${res.statusText}`);
  return res.json();
}

// IP lookup via two public services (no keys)
export async function lookupIP(ip: string): Promise<IPLookup> {
  const ipApiUrl = `https://ip-api.com/json/${encodeURIComponent(ip)}?fields=status,message,country,regionName,city,lat,lon,isp,org,as,reverse,query,timezone`;
  const ipWhoUrl = `https://ipwho.is/${encodeURIComponent(ip)}`;

  const [ipapi, ipwho] = await Promise.allSettled([
    fetchJSON(ipApiUrl),
    fetchJSON(ipWhoUrl),
  ]);

  const sources: Record<string, any> = {};
  let out: IPLookup = { sources };

  if (ipapi.status === 'fulfilled') {
    const d = ipapi.value;
    sources['ip-api.com'] = d;
    if (d.status !== 'fail') {
      out = {
        ...out,
        ip: d.query,
        city: d.city,
        region: d.regionName,
        country: d.country,
        lat: d.lat,
        lon: d.lon,
        isp: d.isp,
        org: d.org,
        asn: d.as,
        reverse: d.reverse,
        timezone: d.timezone,
      };
    }
  }

  if (ipwho.status === 'fulfilled' && ipwho.value.success !== false) {
    const w = ipwho.value;
    sources['ipwho.is'] = w;
    out = {
      ...out,
      ip: out.ip || w.ip,
      city: out.city || w.city,
      region: out.region || w.region,
      country: out.country || w.country,
      lat: out.lat || w.latitude,
      lon: out.lon || w.longitude,
      isp: out.isp || w.connection?.isp || w.connection?.org,
      org: out.org || w.connection?.org,
      asn: out.asn || (w.connection?.asn ? `AS${w.connection?.asn}` : undefined),
      timezone: out.timezone || w.timezone?.id,
    };
  }

  return out;
}

// DNS over HTTPS via Google (CORS-enabled)
async function dohResolve(name: string, type: string) {
  const url = `https://dns.google/resolve?name=${encodeURIComponent(name)}&type=${encodeURIComponent(type)}`;
  try {
    const json = await fetchJSON(url, { headers: { 'accept': 'application/dns-json' } });
    return json.Answer || [];
  } catch {
    return [];
  }
}

export async function lookupDomain(domain: string): Promise<DomainLookup> {
  const [a, aaaa, mx, ns, txt, dmarcTxt, rdap] = await Promise.all([
    dohResolve(domain, 'A'),
    dohResolve(domain, 'AAAA'),
    dohResolve(domain, 'MX'),
    dohResolve(domain, 'NS'),
    dohResolve(domain, 'TXT'),
    dohResolve(`_dmarc.${domain}`, 'TXT'),
    // RDAP aggregator; may not work for all TLDs, so errors are swallowed
    (async () => {
      try {
        return await fetchJSON(`https://rdap.org/domain/${encodeURIComponent(domain)}`);
      } catch {
        return null;
      }
    })(),
  ]);

  const parseTXT = (answers: any[]) =>
    answers
      .map((a: any) => (typeof a.data === 'string' ? a.data.replace(/^"|"$/g, '') : ''))
      .filter(Boolean);

  const out: DomainLookup = {
    domain,
    a: a.map((r: any) => r.data).filter(Boolean),
    aaaa: aaaa.map((r: any) => r.data).filter(Boolean),
    mx: mx
      .map((r: any) => {
        const m = /^(\d+)\s+(.+)\.?$/.exec(r.data);
        return m ? { priority: parseInt(m[1], 10), exchange: m[2].replace(/\.$/, '') } : null;
      })
      .filter(Boolean) as { priority: number; exchange: string }[],
    ns: ns.map((r: any) => String(r.data).replace(/\.$/, '')).filter(Boolean),
    txt: parseTXT(txt),
    dmarc: parseTXT(dmarcTxt).find((t) => t.toLowerCase().includes('v=dmarc')) || null,
    spf: parseTXT(txt).some((t) => t.toLowerCase().includes('v=spf1')),
    rdap,
  };

  return out;
}

export async function lookupEmail(email: string): Promise<EmailLookup> {
  const domain = email.split('@')[1]?.trim().toLowerCase();
  if (!domain) throw new Error('Invalid email');

  const dom = await lookupDomain(domain);
  return {
    email,
    domain,
    hasMX: (dom.mx?.length || 0) > 0,
    hasSPF: !!dom.spf,
    hasDMARC: !!dom.dmarc,
    dmarcPolicy: dom.dmarc ? /p=([^;\s]+)/i.exec(dom.dmarc)?.[1] || null : null,
    txtSamples: dom.txt?.slice(0, 5),
  };
}

export async function lookupUsername(username: string): Promise<UsernameProfile[]> {
  const tasks = [
    (async () => {
      // GitHub public API
      try {
        const data = await fetchJSON(`https://api.github.com/users/${encodeURIComponent(username)}`);
        if (data && data.login) {
          return { platform: 'GitHub', exists: true, url: `https://github.com/${username}`, data } as UsernameProfile;
        }
      } catch {}
      return { platform: 'GitHub', exists: false, url: `https://github.com/${username}` } as UsernameProfile;
    })(),
    (async () => {
      // GitLab public API
      try {
        const arr = await fetchJSON(`https://gitlab.com/api/v4/users?username=${encodeURIComponent(username)}`);
        const u = Array.isArray(arr) ? arr.find((x: any) => String(x.username).toLowerCase() === username.toLowerCase()) : null;
        if (u) return { platform: 'GitLab', exists: true, url: `https://gitlab.com/${username}`, data: u } as UsernameProfile;
      } catch {}
      return { platform: 'GitLab', exists: false, url: `https://gitlab.com/${username}` } as UsernameProfile;
    })(),
    (async () => {
      // Reddit JSON
      try {
        const data = await fetchJSON(`https://www.reddit.com/user/${encodeURIComponent(username)}/about.json`);
        if (data && data.data && data.data.name) {
          return { platform: 'Reddit', exists: true, url: `https://www.reddit.com/user/${username}`, data: data.data } as UsernameProfile;
        }
      } catch {}
      return { platform: 'Reddit', exists: false, url: `https://www.reddit.com/user/${username}` } as UsernameProfile;
    })(),
    (async () => {
      // StackOverflow via StackExchange (best-effort)
      try {
        const data = await fetchJSON(`https://api.stackexchange.com/2.3/users?order=desc&sort=reputation&inname=${encodeURIComponent(username)}&site=stackoverflow`);
        const exists = Array.isArray(data.items) && data.items.length > 0;
        const exact = exists ? data.items.find((x: any) => String(x.display_name).toLowerCase() === username.toLowerCase()) : null;
        return { platform: 'StackOverflow', exists: !!exact || exists, url: `https://stackoverflow.com/users?tab=Reputation&search=${encodeURIComponent(username)}`, data } as UsernameProfile;
      } catch {}
      return { platform: 'StackOverflow', exists: false, url: `https://stackoverflow.com/users?tab=Reputation&search=${encodeURIComponent(username)}` } as UsernameProfile;
    })(),
  ];

  const settled = await Promise.allSettled(tasks);
  return settled.map((s) => (s.status === 'fulfilled' ? s.value : null)).filter(Boolean) as UsernameProfile[];
}

export function scoreIPRisk(ip: IPLookup): RiskLevel {
  const asnText = (ip.asn || '').toLowerCase();
  const orgText = (ip.org || ip.isp || '').toLowerCase();
  const cloudVendors = ['amazon', 'aws', 'google', 'microsoft', 'azure', 'digitalocean', 'linode', 'ovh', 'hetzner', 'contabo', 'vultr'];
  const looksCloud = cloudVendors.some((v) => asnText.includes(v) || orgText.includes(v));
  if (looksCloud) return 'medium';
  return 'low';
}

export function scoreDomainRisk(dom: DomainLookup): RiskLevel {
  if (!dom.a?.length) return 'high';
  const hasMX = (dom.mx?.length || 0) > 0;
  const hasDMARC = !!dom.dmarc;
  if (!hasMX || !hasDMARC) return 'medium';
  return 'low';
}

export function scoreEmailRisk(email: EmailLookup): RiskLevel {
  if (!email.hasMX) return 'high';
  if (!email.hasDMARC) return 'medium';
  return 'low';
}
