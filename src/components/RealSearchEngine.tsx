import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Search, Phone, Mail, Globe, User, MapPin, Clock, Brain, Shield, AlertTriangle } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";

interface SearchResult {
  id: string;
  type: string;
  query: string;
  data: any;
  aiAnalysis?: string;
  sources: string[];
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high';
}

interface ApiKeys {
  perplexity: string;
  openai: string;
}

export const RealSearchEngine = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('phone');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeys>({ perplexity: '', openai: '' });
  const [showApiKeys, setShowApiKeys] = useState(false);
  const { toast } = useToast();

  const performPerplexitySearch = async (query: string, type: string) => {
    if (!apiKeys.perplexity) {
      throw new Error('Perplexity API key required');
    }

    const searchPrompts = {
      phone: `Find public information about phone number ${query}. Include carrier, location, any public records, social media associations, and potential risks.`,
      email: `Search for public information about email address ${query}. Check for data breaches, social media accounts, domain reputation, and any security concerns.`,
      ip: `Analyze IP address ${query}. Provide geolocation, ISP information, reputation data, any security threats, and public records.`,
      username: `Search for username "${query}" across platforms. Find associated accounts, social media presence, public profiles, and any relevant information.`
    };

    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKeys.perplexity}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'llama-3.1-sonar-large-128k-online',
        messages: [
          {
            role: 'system',
            content: 'You are a professional OSINT researcher. Provide factual, publicly available information only. Format your response as structured data with sources.'
          },
          {
            role: 'user',
            content: searchPrompts[type as keyof typeof searchPrompts]
          }
        ],
        temperature: 0.2,
        top_p: 0.9,
        max_tokens: 2000,
        return_images: false,
        return_related_questions: false,
        search_recency_filter: 'month',
      }),
    });

    if (!response.ok) {
      throw new Error(`Perplexity API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'No results found';
  };

  const performOpenAIAnalysis = async (searchData: string, query: string, type: string) => {
    if (!apiKeys.openai) {
      return 'AI analysis unavailable - OpenAI API key required';
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKeys.openai}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4.1-2025-04-14',
        messages: [
          {
            role: 'system',
            content: `You are a cybersecurity analyst. Analyze the following OSINT data and provide:
            1. Risk assessment (low/medium/high)
            2. Key findings summary
            3. Recommendations
            4. Confidence score (0-100)
            Format as JSON with fields: riskLevel, summary, recommendations, confidence`
          },
          {
            role: 'user',
            content: `Analyze this ${type} search data for ${query}:\n\n${searchData}`
          }
        ],
        temperature: 0.3,
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.statusText}`);
    }

    const data = await response.json();
    return data.choices[0]?.message?.content || 'Analysis unavailable';
  };

  const performIPLookup = async (ip: string) => {
    try {
      // Using free ipapi.co service
      const response = await fetch(`https://ipapi.co/${ip}/json/`);
      const data = await response.json();
      return {
        location: `${data.city}, ${data.region}, ${data.country_name}`,
        isp: data.org,
        timezone: data.timezone,
        latitude: data.latitude,
        longitude: data.longitude,
        asn: data.asn,
      };
    } catch (error) {
      console.error('IP lookup failed:', error);
      return null;
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!searchQuery.trim()) {
      toast({
        title: "Error",
        description: "Please enter a search query",
        variant: "destructive",
      });
      return;
    }

    if (!apiKeys.perplexity && !apiKeys.openai) {
      toast({
        title: "API Keys Required",
        description: "Please add your API keys to perform real searches",
        variant: "destructive",
      });
      setShowApiKeys(true);
      return;
    }

    setIsLoading(true);
    
    try {
      let searchData = '';
      let additionalData: any = {};

      // Perform specific API lookups for certain types
      if (searchType === 'ip') {
        const ipData = await performIPLookup(searchQuery);
        if (ipData) {
          additionalData = ipData;
        }
      }

      // Perform Perplexity search for comprehensive data
      if (apiKeys.perplexity) {
        searchData = await performPerplexitySearch(searchQuery, searchType);
      }

      // Get AI analysis
      let aiAnalysis = '';
      let riskLevel: 'low' | 'medium' | 'high' = 'low';
      let confidence = 0;

      if (apiKeys.openai && searchData) {
        try {
          const analysisResult = await performOpenAIAnalysis(searchData, searchQuery, searchType);
          
          // Try to parse JSON response
          try {
            const parsed = JSON.parse(analysisResult);
            riskLevel = parsed.riskLevel || 'low';
            confidence = parsed.confidence || 75;
            aiAnalysis = `Risk Level: ${parsed.riskLevel}\n\nSummary: ${parsed.summary}\n\nRecommendations: ${parsed.recommendations}`;
          } catch {
            aiAnalysis = analysisResult;
            confidence = 75;
          }
        } catch (error) {
          console.error('AI analysis failed:', error);
          aiAnalysis = 'AI analysis failed';
        }
      }

      const result: SearchResult = {
        id: Date.now().toString(),
        type: searchType,
        query: searchQuery,
        data: {
          rawData: searchData,
          ...additionalData,
          timestamp: new Date().toISOString(),
        },
        aiAnalysis,
        sources: ['Perplexity AI', 'Public APIs', 'OSINT Databases'],
        confidence,
        riskLevel,
      };

      setResults([result]);
      setSearchHistory(prev => [searchQuery, ...prev.slice(0, 4)]);
      
      toast({
        title: "Search Complete",
        description: `Real-time search completed for ${searchQuery}`,
      });
    } catch (error) {
      console.error('Search failed:', error);
      toast({
        title: "Search Failed",
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'phone': return <Phone className="h-4 w-4" />;
      case 'email': return <Mail className="h-4 w-4" />;
      case 'ip': return <Globe className="h-4 w-4" />;
      case 'username': return <User className="h-4 w-4" />;
      default: return <Search className="h-4 w-4" />;
    }
  };

  const getRiskColor = (risk: string) => {
    switch (risk) {
      case 'high': return 'bg-destructive';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-primary';
      default: return 'bg-muted';
    }
  };

  const getRiskIcon = (risk: string) => {
    switch (risk) {
      case 'high': return <AlertTriangle className="h-4 w-4" />;
      case 'medium': return <Shield className="h-4 w-4" />;
      case 'low': return <Shield className="h-4 w-4" />;
      default: return <Shield className="h-4 w-4" />;
    }
  };

  return (
    <div className="min-h-screen bg-background cyber-grid">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 glow-text animate-glow">
            HiddenMemory Search
          </h1>
          <p className="text-xl text-muted-foreground mb-4">
            Real-Time OSINT Intelligence with AI Analysis
          </p>
          <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Brain className="h-4 w-4" />
            <span>Powered by Perplexity AI & OpenAI</span>
          </div>
        </div>

        {/* API Keys Configuration */}
        {showApiKeys && (
          <Card className="max-w-2xl mx-auto mb-8 bg-card/50 backdrop-blur-sm border-yellow-500/50">
            <div className="p-6">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Shield className="h-5 w-5" />
                API Configuration (Temporary - Use Supabase for Production)
              </h3>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="perplexity-key">Perplexity API Key</Label>
                  <Input
                    id="perplexity-key"
                    type="password"
                    placeholder="pplx-..."
                    value={apiKeys.perplexity}
                    onChange={(e) => setApiKeys(prev => ({ ...prev, perplexity: e.target.value }))}
                    className="bg-input/50"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Get from <a href="https://perplexity.ai" target="_blank" className="text-primary underline">perplexity.ai</a>
                  </p>
                </div>
                <div>
                  <Label htmlFor="openai-key">OpenAI API Key (Optional)</Label>
                  <Input
                    id="openai-key"
                    type="password"
                    placeholder="sk-..."
                    value={apiKeys.openai}
                    onChange={(e) => setApiKeys(prev => ({ ...prev, openai: e.target.value }))}
                    className="bg-input/50"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    For AI analysis. Get from <a href="https://platform.openai.com" target="_blank" className="text-primary underline">platform.openai.com</a>
                  </p>
                </div>
                <Button onClick={() => setShowApiKeys(false)} className="w-full">
                  Save Configuration
                </Button>
              </div>
            </div>
          </Card>
        )}

        {/* Search Interface */}
        <Card className="max-w-4xl mx-auto mb-8 bg-card/50 backdrop-blur-sm border-border/50 glow-border">
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold">Real-Time Search</h2>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowApiKeys(!showApiKeys)}
              >
                <Shield className="h-4 w-4 mr-2" />
                API Keys
              </Button>
            </div>

            <Tabs value={searchType} onValueChange={setSearchType} className="mb-6">
              <TabsList className="grid w-full grid-cols-4 bg-muted/30">
                <TabsTrigger value="phone" className="flex items-center gap-2">
                  <Phone className="h-4 w-4" />
                  Phone
                </TabsTrigger>
                <TabsTrigger value="email" className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  Email
                </TabsTrigger>
                <TabsTrigger value="ip" className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  IP Address
                </TabsTrigger>
                <TabsTrigger value="username" className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Username
                </TabsTrigger>
              </TabsList>

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

              <TabsContent value="ip">
                <form onSubmit={handleSearch} className="flex gap-4">
                  <Input
                    placeholder="Enter IP address (192.168.1.1)"
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
            </Tabs>

            {/* Search History */}
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

        {/* Results */}
        {results.length > 0 && (
          <div className="max-w-4xl mx-auto">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Search className="h-6 w-6" />
              Real-Time Intelligence Results
            </h2>
            
            <div className="space-y-6">
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
                        <Badge className={getRiskColor(result.riskLevel)} >
                          {getRiskIcon(result.riskLevel)}
                          {result.riskLevel.toUpperCase()} Risk
                        </Badge>
                        <Badge variant="outline">
                          {result.confidence}% Confidence
                        </Badge>
                      </div>
                    </div>

                    {/* IP-specific data */}
                    {result.type === 'ip' && result.data.location && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{result.data.location}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{result.data.isp}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{result.data.timezone}</span>
                        </div>
                      </div>
                    )}

                    {/* AI Analysis */}
                    {result.aiAnalysis && (
                      <div className="mb-4">
                        <h4 className="font-semibold mb-2 flex items-center gap-2">
                          <Brain className="h-4 w-4" />
                          AI Security Analysis
                        </h4>
                        <Textarea
                          value={result.aiAnalysis}
                          readOnly
                          className="bg-muted/30 border-border/50 min-h-[100px]"
                        />
                      </div>
                    )}

                    {/* Raw Data */}
                    <div className="mb-4">
                      <h4 className="font-semibold mb-2">Intelligence Data</h4>
                      <Textarea
                        value={result.data.rawData || 'No data available'}
                        readOnly
                        className="bg-muted/30 border-border/50 min-h-[150px] font-mono text-xs"
                      />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {result.sources.map((source, index) => (
                        <Badge key={index} variant="outline">{source}</Badge>
                      ))}
                      <Badge variant="outline">
                        <Clock className="h-3 w-3 mr-1" />
                        {new Date(result.data.timestamp).toLocaleString()}
                      </Badge>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Supabase Integration Notice */}
        <Card className="max-w-4xl mx-auto mt-8 bg-yellow-500/10 border-yellow-500/50">
          <div className="p-4 text-center">
            <p className="text-sm text-yellow-600 dark:text-yellow-400">
              💡 For production use, connect to Supabase to securely store API keys and enable advanced features
            </p>
          </div>
        </Card>
      </div>
    </div>
  );
};