import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { 
  Users, 
  BarChart3, 
  Shield, 
  AlertTriangle, 
  Eye, 
  Edit, 
  Trash2,
  UserPlus,
  UserMinus,
  Search,
  Filter,
  Calendar,
  Activity
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { apiRequest } from '@/lib/queryClient';

interface User {
  id: number;
  username: string;
  name: string;
  email: string;
  isAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

interface Analytics {
  totalUsers: number;
  totalQuestions: number;
  totalAnswers: number;
  totalPosts: number;
  totalVotes: number;
  recentActivity: {
    questions: number;
    answers: number;
    posts: number;
    users: number;
  };
}

interface AdminLog {
  id: number;
  adminId: number;
  action: string;
  targetType: string;
  targetId: number;
  details: string;
  createdAt: string;
  admin: {
    name: string;
    username: string;
  };
}

export default function AdminPanel() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Auto-refresh data every 30 seconds for real-time updates
  useEffect(() => {
    const interval = setInterval(() => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      queryClient.invalidateQueries({ queryKey: ['/api/admin/logs'] });
    }, 30000);

    return () => clearInterval(interval);
  }, [queryClient]);

  // Manual refresh function
  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['/api/admin/analytics'] }),
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] }),
      queryClient.invalidateQueries({ queryKey: ['/api/admin/logs'] })
    ]);
    setIsRefreshing(false);
    toast({
      title: "Data refreshed",
      description: "All admin data has been updated",
    });
  };

  // Fetch analytics with error handling
  const { data: analytics, isLoading: analyticsLoading, error: analyticsError } = useQuery<Analytics>({
    queryKey: ['/api/admin/analytics'],
    retry: 3,
    refetchOnWindowFocus: true,
  });

  // Fetch users with error handling
  const { data: users, isLoading: usersLoading, error: usersError } = useQuery<User[]>({
    queryKey: ['/api/admin/users', { search: searchQuery }],
    retry: 3,
    refetchOnWindowFocus: true,
  });

  // Fetch admin logs with error handling
  const { data: adminLogs, isLoading: logsLoading, error: logsError } = useQuery<AdminLog[]>({
    queryKey: ['/api/admin/logs'],
    retry: 3,
    refetchOnWindowFocus: true,
  });

  // Update user mutation
  const updateUserMutation = useMutation({
    mutationFn: async ({ userId, userData }: { userId: number; userData: Partial<User> }) => {
      const res = await apiRequest('PUT', `/api/admin/users/${userId}`, userData);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({ title: "User updated successfully" });
      setIsEditModalOpen(false);
    },
    onError: (error: any) => {
      toast({ 
        title: "Error updating user", 
        description: error.message,
        variant: "destructive"
      });
    },
  });

  // Delete user mutation
  const deleteUserMutation = useMutation({
    mutationFn: async (userId: number) => {
      const res = await apiRequest('DELETE', `/api/admin/users/${userId}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({ title: "User deleted successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error deleting user", 
        description: error.message,
        variant: "destructive"
      });
    },
  });

  // Toggle admin status mutation
  const toggleAdminMutation = useMutation({
    mutationFn: async ({ userId, isAdmin }: { userId: number; isAdmin: boolean }) => {
      const endpoint = isAdmin ? 'make-admin' : 'remove-admin';
      const res = await apiRequest('POST', `/api/admin/users/${userId}/${endpoint}`);
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/admin/users'] });
      toast({ title: "Admin status updated successfully" });
    },
    onError: (error: any) => {
      toast({ 
        title: "Error updating admin status", 
        description: error.message,
        variant: "destructive"
      });
    },
  });

  const handleEditUser = (user: User) => {
    setSelectedUser(user);
    setIsEditModalOpen(true);
  };

  const handleSaveUser = () => {
    if (selectedUser) {
      updateUserMutation.mutate({
        userId: selectedUser.id,
        userData: selectedUser,
      });
    }
  };

  const handleDeleteUser = (userId: number) => {
    if (confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      deleteUserMutation.mutate(userId);
    }
  };

  const handleToggleAdmin = (userId: number, currentIsAdmin: boolean) => {
    const action = currentIsAdmin ? 'remove admin privileges from' : 'grant admin privileges to';
    if (confirm(`Are you sure you want to ${action} this user?`)) {
      toggleAdminMutation.mutate({
        userId,
        isAdmin: !currentIsAdmin,
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <Shield className="h-8 w-8 text-primary" />
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                Admin Panel
              </h1>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <div className="h-2 w-2 bg-green-500 rounded-full animate-pulse"></div>
                Real-time
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground">
            Manage users, monitor activity, and maintain the platform
          </p>
        </div>

        <Tabs defaultValue="analytics" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="analytics" className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="users" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Users
            </TabsTrigger>
            <TabsTrigger value="content" className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              Content
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Activity Logs
            </TabsTrigger>
          </TabsList>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-6">
            {analyticsError && (
              <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950">
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                    <AlertCircle className="h-4 w-4" />
                    <span>Failed to load analytics data. Please try refreshing.</span>
                  </div>
                </CardContent>
              </Card>
            )}
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Users</CardTitle>
                  <Users className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {analyticsLoading ? (
                    <>
                      <Skeleton className="h-8 w-16 mb-2" />
                      <Skeleton className="h-4 w-24" />
                    </>
                  ) : (
                    <>
                      <div className="text-2xl font-bold">{analytics?.totalUsers || 0}</div>
                      <p className="text-xs text-muted-foreground">
                        +{analytics?.recentActivity.users || 0} this month
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Questions</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {analyticsLoading ? (
                    <>
                      <Skeleton className="h-8 w-16 mb-2" />
                      <Skeleton className="h-4 w-24" />
                    </>
                  ) : (
                    <>
                      <div className="text-2xl font-bold">{analytics?.totalQuestions || 0}</div>
                      <p className="text-xs text-muted-foreground">
                        +{analytics?.recentActivity.questions || 0} this month
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Answers</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {analyticsLoading ? (
                    <>
                      <Skeleton className="h-8 w-16 mb-2" />
                      <Skeleton className="h-4 w-24" />
                    </>
                  ) : (
                    <>
                      <div className="text-2xl font-bold">{analytics?.totalAnswers || 0}</div>
                      <p className="text-xs text-muted-foreground">
                        +{analytics?.recentActivity.answers || 0} this month
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Posts</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {analyticsLoading ? (
                    <>
                      <Skeleton className="h-8 w-16 mb-2" />
                      <Skeleton className="h-4 w-24" />
                    </>
                  ) : (
                    <>
                      <div className="text-2xl font-bold">{analytics?.totalPosts || 0}</div>
                      <p className="text-xs text-muted-foreground">
                        +{analytics?.recentActivity.posts || 0} this month
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Votes</CardTitle>
                  <BarChart3 className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  {analyticsLoading ? (
                    <>
                      <Skeleton className="h-8 w-16 mb-2" />
                      <Skeleton className="h-4 w-24" />
                    </>
                  ) : (
                    <>
                      <div className="text-2xl font-bold">{analytics?.totalVotes || 0}</div>
                      <p className="text-xs text-muted-foreground">
                        All time engagement
                      </p>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  User Management
                </CardTitle>
                <CardDescription>
                  View and manage all users on the platform
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 mb-6">
                  <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search users..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-9"
                    />
                  </div>
                </div>

                {usersError && (
                  <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950 mb-4">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                        <AlertCircle className="h-4 w-4" />
                        <span>Failed to load users data. Please try refreshing.</span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>User</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Joined</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {usersLoading ? (
                        // Loading skeletons
                        Array.from({ length: 5 }).map((_, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <div>
                                <Skeleton className="h-4 w-32 mb-1" />
                                <Skeleton className="h-3 w-24" />
                              </div>
                            </TableCell>
                            <TableCell><Skeleton className="h-4 w-40" /></TableCell>
                            <TableCell><Skeleton className="h-6 w-16" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Skeleton className="h-8 w-8" />
                                <Skeleton className="h-8 w-8" />
                                <Skeleton className="h-8 w-8" />
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : users?.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No users found
                          </TableCell>
                        </TableRow>
                      ) : (
                        users?.map((user) => (
                          <TableRow key={user.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{user.name}</div>
                                <div className="text-sm text-muted-foreground">@{user.username}</div>
                              </div>
                            </TableCell>
                            <TableCell>{user.email}</TableCell>
                            <TableCell>
                              <Badge variant={user.isAdmin ? "default" : "secondary"}>
                                {user.isAdmin ? "Admin" : "User"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {format(new Date(user.createdAt), 'MMM d, yyyy')}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-2">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleEditUser(user)}
                                  className="flex items-center gap-1"
                                >
                                  <Edit className="h-4 w-4" />
                                  <span className="hidden sm:inline">Edit</span>
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleToggleAdmin(user.id, user.isAdmin)}
                                  className="flex items-center gap-1"
                                >
                                  {user.isAdmin ? <UserMinus className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                                  <span className="hidden sm:inline">{user.isAdmin ? "Remove" : "Make"} Admin</span>
                                </Button>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleDeleteUser(user.id)}
                                  className="flex items-center gap-1"
                                >
                                  <Trash2 className="h-4 w-4" />
                                  <span className="hidden sm:inline">Delete</span>
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Content Moderation Tab */}
          <TabsContent value="content" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" />
                  Content Moderation
                </CardTitle>
                <CardDescription>
                  Monitor and moderate questions, answers, and posts
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <AlertTriangle className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">Content Moderation</h3>
                  <p className="text-muted-foreground">
                    Content moderation tools will be available here. This includes flagged content,
                    reported posts, and automated content filtering.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Activity Logs Tab */}
          <TabsContent value="logs" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Activity className="h-5 w-5" />
                  Activity Logs
                </CardTitle>
                <CardDescription>
                  View all admin actions and system activities
                </CardDescription>
              </CardHeader>
              <CardContent>
                {logsError && (
                  <Card className="border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-950 mb-4">
                    <CardContent className="pt-6">
                      <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
                        <AlertCircle className="h-4 w-4" />
                        <span>Failed to load activity logs. Please try refreshing.</span>
                      </div>
                    </CardContent>
                  </Card>
                )}

                <div className="border rounded-md">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Admin</TableHead>
                        <TableHead>Action</TableHead>
                        <TableHead>Target</TableHead>
                        <TableHead>Details</TableHead>
                        <TableHead>Time</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {logsLoading ? (
                        // Loading skeletons
                        Array.from({ length: 5 }).map((_, index) => (
                          <TableRow key={index}>
                            <TableCell>
                              <div>
                                <Skeleton className="h-4 w-32 mb-1" />
                                <Skeleton className="h-3 w-24" />
                              </div>
                            </TableCell>
                            <TableCell><Skeleton className="h-6 w-20" /></TableCell>
                            <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-48" /></TableCell>
                            <TableCell><Skeleton className="h-4 w-28" /></TableCell>
                          </TableRow>
                        ))
                      ) : adminLogs?.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                            No activity logs found
                          </TableCell>
                        </TableRow>
                      ) : (
                        adminLogs?.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell>
                              <div>
                                <div className="font-medium">{log.admin.name}</div>
                                <div className="text-sm text-muted-foreground">@{log.admin.username}</div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">{log.action}</Badge>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {log.targetType} #{log.targetId}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <div className="max-w-xs truncate text-sm text-muted-foreground">
                                {log.details}
                              </div>
                            </TableCell>
                            <TableCell>
                              {format(new Date(log.createdAt), 'MMM d, yyyy HH:mm')}
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Edit User Modal */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit User</DialogTitle>
              <DialogDescription>
                Update user information and permissions
              </DialogDescription>
            </DialogHeader>
            {selectedUser && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="name">Name</Label>
                    <Input
                      id="name"
                      value={selectedUser.name}
                      onChange={(e) => setSelectedUser({...selectedUser, name: e.target.value})}
                    />
                  </div>
                  <div>
                    <Label htmlFor="username">Username</Label>
                    <Input
                      id="username"
                      value={selectedUser.username}
                      onChange={(e) => setSelectedUser({...selectedUser, username: e.target.value})}
                    />
                  </div>
                </div>
                <div>
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={selectedUser.email}
                    onChange={(e) => setSelectedUser({...selectedUser, email: e.target.value})}
                  />
                </div>
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="isAdmin"
                    checked={selectedUser.isAdmin}
                    onChange={(e) => setSelectedUser({...selectedUser, isAdmin: e.target.checked})}
                  />
                  <Label htmlFor="isAdmin">Admin privileges</Label>
                </div>
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
                    Cancel
                  </Button>
                  <Button onClick={handleSaveUser}>
                    Save Changes
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}