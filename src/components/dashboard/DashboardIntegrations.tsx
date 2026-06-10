
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Home, 
  Building2, 
  Factory, 
  Landmark, 
  ClipboardList, 
  BarChart2, 
  RotateCcw, 
  Clock, 
  Map, 
  ShoppingBag, 
  FileCheck, 
  Search,
  Users,
  Info,
  Star
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';

interface UserProfile {
  id: string;
  user_type: string;
  full_name: string;
  email: string;
}

interface FeatureUsage {
  feature_name: string;
  usage_count: number;
  last_used: string;
}

const DashboardIntegrations = () => {
  const { user } = useAuth();
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [featureUsage, setFeatureUsage] = useState<FeatureUsage[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (user) {
      fetchUserProfile();
      fetchFeatureUsage();
    }
  }, [user]);

  const fetchUserProfile = async () => {
    if (!user) return;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();

      if (error) throw error;
      setUserProfile(data);
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const fetchFeatureUsage = async () => {
    // This would typically come from a feature_usage table
    // For now, we'll simulate this data
    setFeatureUsage([
      { feature_name: 'Waste Data Entry', usage_count: 15, last_used: '2025-01-29' },
      { feature_name: 'Route Optimization', usage_count: 8, last_used: '2025-01-28' },
      { feature_name: 'Marketplace', usage_count: 3, last_used: '2025-01-27' },
      { feature_name: 'Analytics', usage_count: 12, last_used: '2025-01-29' }
    ]);
    setIsLoading(false);
  };

  const userTypes = [
    {
      id: "household",
      title: "Household Users",
      icon: Home,
      description: "Individual households managing domestic waste efficiently",
      features: ["Log Waste Data", "Collection Scheduling", "Waste Insights"],
      color: "bg-eco-green-50",
      iconColor: "text-eco-green-600"
    },
    {
      id: "municipality",
      title: "Municipality Users",
      icon: Building2,
      description: "City and town waste management agencies",
      features: ["Route Optimization", "Analyze Data", "Resource Management"],
      color: "bg-blue-50",
      iconColor: "text-blue-600"
    },
    {
      id: "industry",
      title: "Industry & MSME Users",
      icon: Factory,
      description: "Businesses managing industrial waste",
      features: ["Categorization & Storage", "Marketplace Listing", "Transaction Management"],
      color: "bg-amber-50",
      iconColor: "text-amber-600"
    },
    {
      id: "government",
      title: "Government & Regulatory",
      icon: Landmark,
      description: "Agencies overseeing compliance and planning",
      features: ["Oversight Dashboard", "Compliance Reporting", "Infrastructure Planning"],
      color: "bg-purple-50",
      iconColor: "text-purple-600"
    }
  ];

  const features = [
    {
      title: "Log Waste Data",
      description: "Record and categorize waste data with environmental impact calculations",
      icon: ClipboardList,
      route: "/waste-entry",
      category: "Data Management"
    },
    {
      title: "Route Optimization",
      description: "Optimize collection routes to save time, fuel, and reduce carbon footprint",
      icon: Map,
      route: "/route-optimization",
      category: "Operations"
    },
    {
      title: "Waste Analytics",
      description: "Comprehensive waste generation and recycling analytics",
      icon: BarChart2,
      route: "/analytics",
      category: "Analytics"
    },
    {
      title: "Collection Scheduling",
      description: "Schedule waste collection pickups with notifications",
      icon: Clock,
      route: "/dashboard",
      category: "Operations"
    },
    {
      title: "Circular Economy Marketplace",
      description: "Buy and sell recyclable materials",
      icon: ShoppingBag,
      route: "/marketplace",
      category: "Marketplace"
    },
    {
      title: "Compliance Reporting",
      description: "Generate compliance reports for regulatory requirements",
      icon: FileCheck,
      route: "/dashboard",
      category: "Compliance"
    },
    {
      title: "Real-time Tracking",
      description: "Track waste from generation to processing",
      icon: Search,
      route: "/dashboard",
      category: "Tracking"
    },
    {
      title: "Sustainable Practices",
      description: "Get recommendations for improving waste management",
      icon: RotateCcw,
      route: "/dashboard",
      category: "Sustainability"
    }
  ];

  const getCurrentUserType = () => {
    return userTypes.find(type => type.id === userProfile?.user_type) || userTypes[0];
  };

  if (isLoading) {
    return <div className="text-center py-8">Loading dashboard integrations...</div>;
  }

  const currentUserType = getCurrentUserType();
  const UserIcon = currentUserType.icon;

  return (
    <div className="space-y-6">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="user-types">User Types</TabsTrigger>
          <TabsTrigger value="features">Features</TabsTrigger>
          <TabsTrigger value="about">About</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Your Profile
              </CardTitle>
            </CardHeader>
            <CardContent>
              {userProfile && (
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className={`p-3 rounded-lg ${currentUserType.color}`}>
                      <UserIcon className={`h-6 w-6 ${currentUserType.iconColor}`} />
                    </div>
                    <div>
                      <h3 className="font-semibold">{currentUserType.title}</h3>
                      <p className="text-sm text-gray-600">{userProfile.full_name}</p>
                      <Badge variant="outline">{userProfile.user_type}</Badge>
                    </div>
                  </div>
                  <p className="text-gray-600">{currentUserType.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Feature Usage Statistics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                {featureUsage.map((usage) => (
                  <div key={usage.feature_name} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
                    <div>
                      <h4 className="font-medium">{usage.feature_name}</h4>
                      <p className="text-sm text-gray-600">Last used: {usage.last_used}</p>
                    </div>
                    <Badge variant="secondary">{usage.usage_count} uses</Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="user-types" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {userTypes.map((type) => {
              const TypeIcon = type.icon;
              return (
                <Card key={type.id} className={`${type.color} border-none shadow-md`}>
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${type.color} border-2 border-eco-green-200`}>
                        <TypeIcon className={`h-6 w-6 ${type.iconColor}`} />
                      </div>
                      <CardTitle className="text-lg">{type.title}</CardTitle>
                      {userProfile?.user_type === type.id && (
                        <Badge variant="default">Current</Badge>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="mb-4">{type.description}</CardDescription>
                    <div className="space-y-2">
                      <h4 className="font-medium">Available Features:</h4>
                      {type.features.map((feature, i) => (
                        <div key={i} className="flex items-center">
                          <div className="h-2 w-2 rounded-full bg-eco-green-500 mr-2"></div>
                          <span className="text-sm">{feature}</span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="features" className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, index) => {
              const FeatureIcon = feature.icon;
              return (
                <Card key={index} className="hover:shadow-lg transition-shadow">
                  <CardHeader>
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-eco-green-100 text-eco-green-600">
                        <FeatureIcon className="h-5 w-5" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{feature.title}</CardTitle>
                        <Badge variant="outline" className="text-xs">
                          {feature.category}
                        </Badge>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <CardDescription className="mb-4">{feature.description}</CardDescription>
                    <Link to={feature.route}>
                      <Button variant="outline" className="w-full">
                        Access Feature
                      </Button>
                    </Link>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="about" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Info className="h-5 w-5" />
                About CivicSort Labs
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="font-semibold mb-2">Our Mission</h3>
                <p className="text-gray-600">
                  CivicSort Labs is dedicated to revolutionizing waste management through technology, 
                  promoting circular economy principles, and enabling sustainable practices across 
                  all stakeholders in the waste management ecosystem.
                </p>
              </div>
              
              <div>
                <h3 className="font-semibold mb-2">Key Benefits</h3>
                <ul className="space-y-2">
                  {[
                    "Reduce environmental impact through optimized waste management",
                    "Enable circular economy through material marketplace",
                    "Provide data-driven insights for better decision making",
                    "Streamline compliance and reporting processes",
                    "Connect stakeholders for collaborative sustainability"
                  ].map((benefit, index) => (
                    <li key={index} className="flex items-start gap-2">
                      <Star className="h-4 w-4 text-eco-green-600 mt-1 flex-shrink-0" />
                      <span className="text-gray-600">{benefit}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div>
                <h3 className="font-semibold mb-2">Getting Started</h3>
                <p className="text-gray-600 mb-4">
                  Your journey towards sustainable waste management starts here. Based on your 
                  user type, you have access to specialized features designed to meet your needs.
                </p>
                <div className="flex gap-2">
                  <Link to="/waste-entry">
                    <Button className="bg-eco-green-600 hover:bg-eco-green-700">
                      Start Logging Waste
                    </Button>
                  </Link>
                  <Link to="/marketplace">
                    <Button variant="outline">
                      Explore Marketplace
                    </Button>
                  </Link>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default DashboardIntegrations;
