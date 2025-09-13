import { useCallback, useMemo, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { Search, Phone, Mail, Globe, User, MapPin, Clock, Shield, Network, Server, LinkIcon, Layers } from 'lucide-react';
import { lookupIP, lookupDomain, lookupEmail, lookupUsername, scoreDomainRisk, scoreEmailRisk, scoreIPRisk, type RiskLevel } from '@/utils/osint';
import { parsePhoneNumberFromString } from 'libphonenumber-js';

interface SearchResult {
  id: string;
  type: 'phone' | 'email' | 'ip' | 'username' | 'domain';
  query: string;
  data: any;
  sources?: string[];
  confidence?: number;
  riskLevel?: RiskLevel;
}

export const RealSearchEngine = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'phone' | 'email' | 'ip' | 'username' | 'domain'>('ip');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const { toast } = useToast();

  const isIP = useMemo(() => /^(\d{1,3}\.){3}\d{1,3}$/.test(searchQuery.trim()) || /:/.test(searchQuery.trim()), [searchQuery]);

  const handleSearch = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) {
      toast({ title: 'Error', description: 'Please enter a search query', variant: 'destructive' });
      return;
    }

    setIsLoading(true);
    try {
      let result: SearchResult | null = null;

      if (searchType === 'ip') {
        const ipData = await lookupIP(q);
        const risk = scoreIPRisk(ipData);
        result = {
          id: Date.now().toString(),
          type: 'ip',
          query: q,
          data: ipData,
          sources: Object.keys(ipData.sources || {}),
          riskLevel: risk,
          confidence: 85,
        };
      }

      if (searchType === 'domain') {
        const dom = await lookupDomain(q);
        const risk = scoreDomainRisk(dom);
        result = {
          id: Date.now().toString(),
          type: 'domain',
          query: q,
          data: dom,
          riskLevel: risk,
          confidence: 80,
        };
      }

      if (searchType === 'email') {
        const em = await lookupEmail(q);
        const risk = scoreEmailRisk(em);
        result = {
          id: Date.now().toString(),
          type: 'email',
          query: q,
          data: em,
          riskLevel: risk,
          confidence: 70,
        };
      }

      if (searchType === 'username') {
        const profiles = await lookupUsername(q);
        result = {
          id: Date.now().toString(),
          type: 'username',
          query: q,
          data: { profiles },
          confidence: Math.min(95, profiles.filter(p => p.exists).length * 20),
        };
      }

      if (searchType === 'phone') {
        const phone = parsePhoneNumberFromString(q);
        if (!phone) throw new Error('Invalid phone number format');
        result = {
          id: Date.now().toString(),
          type: 'phone',
          query: q,
          data: {
            formatted: phone.formatInternational(),
            country: phone.country,
            valid: phone.isValid(),
            possible: phone.isPossible(),
            type: phone.getType?.(),
          },
          confidence: phone.isValid() ? 80 : 40,
        };
      }

      if (!result) throw new Error('Unsupported search type');
      setResults([result]);
      setSearchHistory(prev => [q, ...prev.filter((v) => v !== q)].slice(0, 6));
      toast({ title: 'Search Complete', description: `Fetched live data for ${q}` });
    } catch (error) {
      console.error(error);
      toast({ title: 'Search Failed', description: error instanceof Error ? error.message : 'Unknown error', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, searchType, toast]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'phone': return <Phone className="h-4 w-4" />;
      case 'email': return <Mail className="h-4 w-4" />;
      case 'ip': return <Globe className="h-4 w-4" />;
      case 'username': return <User className="h-4 w-4" />;
      case 'domain': return <Server className="h-4 w-4" />;
      default: return <Search className="h-4 w-4" />;
    }
  };

  const riskBadgeClass = (risk?: RiskLevel) => {
    switch (risk) {
      case 'high': return 'bg-destructive';
      case 'medium': return 'bg-warning';
      default: return 'bg-primary';
    }
  };

  return (
    <div className="min-h-screen bg-background cyber-grid">
      <div className="container mx-auto px-4 py-8">
        <header className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 glow-text animate-glow">HiddenMemory Search</h1>
          <p className="text-xl text-muted-foreground">Keyless OSINT: IP, Domain, Email, Username, Phone</p>
        </header>

        <Card className="max-w-4xl mx-auto mb-8 bg-card/50 backdrop-blur-sm border-border/50 glow-border">
          <div className="p-6">
            <Tabs value={searchType} onValueChange={(v) => setSearchType(v as any)} className="mb-6">
              <TabsList className="grid w-full grid-cols-5 bg-muted/30">
                <TabsTrigger value="ip" className="flex items-center gap-2"><Globe className="h-4 w-4" /> IP</TabsTrigger>
                <TabsTrigger value="domain" className="flex items-center gap-2"><Server className="h-4 w-4" /> Domain</TabsTrigger>
                <TabsTrigger value="email" className="flex items-center gap-2"><Mail className="h-4 w-4" /> Email</TabsTrigger>
                <TabsTrigger value="username" className="flex items-center gap-2"><User className="h-4 w-4" /> Username</TabsTrigger>
                <TabsTrigger value="phone" className="flex items-center gap-2"><Phone className="h-4 w-4" /> Phone</TabsTrigger>
              </TabsList>

              <TabsContent value="ip">
                <form onSubmit={handleSearch} className="flex gap-4">
                  <Input
                    placeholder="Enter IP address (e.g., 8.8.8.8)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 bg-input/50 border-border/50"
                  />
                  <Button type="submit" disabled={isLoading} className="bg-primary hover:bg-primary/80">
                    {isLoading ? 'Searching...' : 'Search'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="domain">
                <form onSubmit={handleSearch} className="flex gap-4">
                  <Input
                    placeholder="Enter domain (e.g., example.com)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 bg-input/50 border-border/50"
                  />
                  <Button type="submit" disabled={isLoading} className="bg-primary hover:bg-primary/80">
                    {isLoading ? 'Searching...' : 'Search'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="email">
                <form onSubmit={handleSearch} className="flex gap-4">
                  <Input
                    placeholder="Enter email address"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 bg-input/50 border-border/50"
                  />
                  <Button type="submit" disabled={isLoading} className="bg-primary hover:bg-primary/80">
                    {isLoading ? 'Searching...' : 'Search'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="username">
                <form onSubmit={handleSearch} className="flex gap-4">
                  <Input
                    placeholder="Enter username"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 bg-input/50 border-border/50"
                  />
                  <Button type="submit" disabled={isLoading} className="bg-primary hover:bg-primary/80">
                    {isLoading ? 'Searching...' : 'Search'}
                  </Button>
                </form>
              </TabsContent>

              <TabsContent value="phone">
                <form onSubmit={handleSearch} className="flex gap-4">
                  <Input
                    placeholder="Enter phone number (+1234567890)"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="flex-1 bg-input/50 border-border/50"
                  />
                  <Button type="submit" disabled={isLoading} className="bg-primary hover:bg-primary/80">
                    {isLoading ? 'Searching...' : 'Search'}
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            {searchHistory.length > 0 && (
              <div>
                <h3 className="text-sm font-medium mb-2 text-muted-foreground">Recent Searches:</h3>
                <div className="flex flex-wrap gap-2">
                  {searchHistory.map((query, index) => (
                    <Badge
                      key={index}
                      variant="outline"
                      className="cursor-pointer hover:bg-primary/20"
                      onClick={() => setSearchQuery(query)}
                    >
                      {query}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>
        </Card>

        {results.length > 0 && (
          <div className="max-w-4xl mx-auto space-y-6">
            {results.map((result) => (
              <Card key={result.id} className="bg-card/50 backdrop-blur-sm border-border/50">
                <div className="p-6">
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex items-center gap-3">
                      {getIcon(result.type)}
                      <div>
                        <h3 className="font-bold text-lg">{result.query}</h3>
                        <p className="text-sm text-muted-foreground">{result.type.toUpperCase()} Intelligence</p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {result.riskLevel && (
                        <Badge className={riskBadgeClass(result.riskLevel)}>{result.riskLevel.toUpperCase()} Risk</Badge>
                      )}
                      {typeof result.confidence === 'number' && (
                        <Badge variant="outline">{result.confidence}% Confidence</Badge>
                      )}
                    </div>
                  </div>

                  {/* IP */}
                  {result.type === 'ip' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex items-center gap-2"><MapPin className="h-4 w-4 text-muted-foreground" /><span className="text-sm">{result.data.city}, {result.data.region}, {result.data.country}</span></div>
                        <div className="flex items-center gap-2"><Network className="h-4 w-4 text-muted-foreground" /><span className="text-sm">{result.data.isp || result.data.org}</span></div>
                        <div className="flex items-center gap-2"><Clock className="h-4 w-4 text-muted-foreground" /><span className="text-sm">{result.data.timezone}</span></div>
                      </div>
                      <Textarea readOnly className="bg-muted/30 border-border/50 min-h-[120px] font-mono text-xs" value={JSON.stringify(result.data.sources, null, 2)} />
                    </div>
                  )}

                  {/* Domain */}
                  {result.type === 'domain' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <h4 className="font-semibold mb-2 flex items-center gap-2"><Server className="h-4 w-4" /> DNS A/AAAA</h4>
                          <div className="flex flex-wrap gap-2">{(result.data.a || []).map((ip: string, i: number) => (<Badge key={`a-${i}`} variant="outline">{ip}</Badge>))}</div>
                          <div className="flex flex-wrap gap-2 mt-2">{(result.data.aaaa || []).map((ip: string, i: number) => (<Badge key={`aaaa-${i}`} variant="outline">{ip}</Badge>))}</div>
                        </div>
                        <div>
                          <h4 className="font-semibold mb-2 flex items-center gap-2"><Layers className="h-4 w-4" /> MX/NS</h4>
                          <div className="flex flex-wrap gap-2">{(result.data.mx || []).map((m: any, i: number) => (<Badge key={`mx-${i}`} variant="outline">{m.priority} {m.exchange}</Badge>))}</div>
                          <div className="flex flex-wrap gap-2 mt-2">{(result.data.ns || []).map((n: string, i: number) => (<Badge key={`ns-${i}`} variant="outline">{n}</Badge>))}</div>
                        </div>
                      </div>
                      {result.data.txt?.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-2">TXT (sample)</h4>
                          <Textarea readOnly className="bg-muted/30 border-border/50 min-h-[120px] font-mono text-xs" value={(result.data.txt || []).slice(0, 6).join('\n')} />
                        </div>
                      )}
                      {result.data.rdap && (
                        <div>
                          <h4 className="font-semibold mb-2">RDAP</h4>
                          <Textarea readOnly className="bg-muted/30 border-border/50 min-h-[120px] font-mono text-xs" value={JSON.stringify(result.data.rdap, null, 2)} />
                        </div>
                      )}
                      <div className="mt-2">
                        <a className="inline-flex items-center gap-2 text-primary underline" href={`https://${result.query}`} target="_blank" rel="noopener noreferrer">
                          <LinkIcon className="h-4 w-4" /> Visit {result.query}
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Email */}
                  {result.type === 'email' && (
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="flex items-center gap-2"><Server className="h-4 w-4 text-muted-foreground" /><span className="text-sm">MX: {result.data.hasMX ? 'Yes' : 'No'}</span></div>
                        <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-muted-foreground" /><span className="text-sm">SPF: {result.data.hasSPF ? 'Yes' : 'No'}</span></div>
                        <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-muted-foreground" /><span className="text-sm">DMARC: {result.data.hasDMARC ? (result.data.dmarcPolicy || 'Yes') : 'No'}</span></div>
                      </div>
                      {result.data.txtSamples?.length > 0 && (
                        <div>
                          <h4 className="font-semibold mb-2">TXT (sample)</h4>
                          <Textarea readOnly className="bg-muted/30 border-border/50 min-h-[120px] font-mono text-xs" value={(result.data.txtSamples || []).join('\n')} />
                        </div>
                      )}
                      <div className="mt-2">
                        <a className="inline-flex items-center gap-2 text-primary underline" href={`https://${result.data.domain}`} target="_blank" rel="noopener noreferrer">
                          <LinkIcon className="h-4 w-4" /> Visit {result.data.domain}
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Username */}
                  {result.type === 'username' && (
                    <div className="space-y-3">
                      <div className="flex flex-wrap gap-2">
                        {result.data.profiles.map((p: any, i: number) => (
                          <a key={i} href={p.url} target="_blank" rel="noopener noreferrer">
                            <Badge className={p.exists ? 'bg-primary' : 'bg-muted'}>{p.platform}</Badge>
                          </a>
                        ))}
                      </div>
                      <Textarea readOnly className="bg-muted/30 border-border/50 min-h-[120px] font-mono text-xs" value={JSON.stringify(result.data.profiles, null, 2)} />
                    </div>
                  )}

                  {/* Phone */}
                  {result.type === 'phone' && (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-muted-foreground" /><span className="text-sm">{result.data.formatted}</span></div>
                      <div className="flex items-center gap-2"><Globe className="h-4 w-4 text-muted-foreground" /><span className="text-sm">{result.data.country || 'N/A'}</span></div>
                      <div className="flex items-center gap-2"><Shield className="h-4 w-4 text-muted-foreground" /><span className="text-sm">Valid: {result.data.valid ? 'Yes' : 'No'}</span></div>
                    </div>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};