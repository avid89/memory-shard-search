import { useState } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Search, Phone, Mail, Globe, User, MapPin, Clock } from 'lucide-react';
import { useToast } from "@/components/ui/use-toast";

interface SearchResult {
  id: string;
  type: string;
  query: string;
  data: {
    source?: string;
    location?: string;
    provider?: string;
    status?: string;
    lastSeen?: string;
    confidence?: number;
    details?: Record<string, any>;
  };
}

const mockResults: Record<string, SearchResult[]> = {
  phone: [
    {
      id: '1',
      type: 'phone',
      query: '+1234567890',
      data: {
        source: 'Public Records',
        location: 'California, US',
        provider: 'Verizon',
        status: 'Active',
        lastSeen: '2024-01-15',
        confidence: 85
      }
    }
  ],
  email: [
    {
      id: '2',
      type: 'email',
      query: 'user@example.com',
      data: {
        source: 'Social Media',
        provider: 'Gmail',
        status: 'Valid',
        lastSeen: '2024-01-10',
        confidence: 92,
        details: {
          breaches: 2,
          accounts: ['Twitter', 'LinkedIn']
        }
      }
    }
  ],
  ip: [
    {
      id: '3',
      type: 'ip',
      query: '192.168.1.1',
      data: {
        source: 'GeoIP Database',
        location: 'United States',
        provider: 'Private Network',
        status: 'Active',
        confidence: 95
      }
    }
  ]
};

export const SearchEngine = () => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState('phone');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const { toast } = useToast();

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

    setIsLoading(true);
    
    // Simulate API call
    setTimeout(() => {
      const mockData = mockResults[searchType] || [];
      setResults(mockData);
      setSearchHistory(prev => [searchQuery, ...prev.slice(0, 4)]);
      setIsLoading(false);
      
      toast({
        title: "Search Complete",
        description: `Found ${mockData.length} result(s) for ${searchQuery}`,
      });
    }, 1500);
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

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 90) return 'bg-primary';
    if (confidence >= 70) return 'bg-secondary';
    return 'bg-muted';
  };

  return (
    <div className="min-h-screen bg-background cyber-grid">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 glow-text animate-glow">
            HiddenMemory Search
          </h1>
          <p className="text-xl text-muted-foreground">
            Advanced OSINT Data Intelligence Platform
          </p>
        </div>

        {/* Search Interface */}
        <Card className="max-w-4xl mx-auto mb-8 bg-card/50 backdrop-blur-sm border-border/50 glow-border">
          <div className="p-6">
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
              Search Results
            </h2>
            
            <div className="space-y-4">
              {results.map((result) => (
                <Card key={result.id} className="bg-card/50 backdrop-blur-sm border-border/50">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex items-center gap-3">
                        {getIcon(result.type)}
                        <div>
                          <h3 className="font-bold text-lg">{result.query}</h3>
                          <p className="text-sm text-muted-foreground">{result.type.toUpperCase()} Search</p>
                        </div>
                      </div>
                      <Badge className={getConfidenceColor(result.data.confidence || 0)}>
                        {result.data.confidence}% Confidence
                      </Badge>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      {result.data.location && (
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{result.data.location}</span>
                        </div>
                      )}
                      {result.data.provider && (
                        <div className="flex items-center gap-2">
                          <Globe className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{result.data.provider}</span>
                        </div>
                      )}
                      {result.data.lastSeen && (
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">Last seen: {result.data.lastSeen}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Badge variant="outline">{result.data.source}</Badge>
                      <Badge variant="outline">{result.data.status}</Badge>
                      {result.data.details?.breaches && (
                        <Badge variant="destructive">
                          {result.data.details.breaches} Breaches
                        </Badge>
                      )}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};