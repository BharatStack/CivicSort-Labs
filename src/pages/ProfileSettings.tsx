import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, User, Mail, Phone, FileText, Shield, Save, Loader2, LogOut, Eye, EyeOff, Camera } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import MyReports from '@/components/reports/MyReports';

const ProfileSettings: React.FC = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Profile fields
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [userType, setUserType] = useState('');

  // Password change
  const [showPasswordSection, setShowPasswordSection] = useState(false);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (user) fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user?.id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      if (data) {
        setFullName(data.full_name || '');
        setPhone((data as any).phone || '');
        setBio((data as any).bio || '');
        setAvatarUrl((data as any).avatar_url || '');
        setUserType(data.user_type || 'citizen');
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .upsert({
          id: user.id,
          full_name: fullName.trim(),
          phone: phone.trim(),
          bio: bio.trim(),
          avatar_url: avatarUrl.trim(),
          updated_at: new Date().toISOString(),
        } as any);

      if (error) throw error;

      toast({ title: '✅ Profile updated!', description: 'Your changes have been saved.' });
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to update profile', variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async () => {
    if (newPassword.length < 8) {
      toast({ title: 'Error', description: 'Password must be at least 8 characters', variant: 'destructive' });
      return;
    }
    if (newPassword !== confirmPassword) {
      toast({ title: 'Error', description: 'Passwords do not match', variant: 'destructive' });
      return;
    }

    setChangingPassword(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      toast({ title: '🔒 Password changed!', description: 'Your password has been updated successfully.' });
      setNewPassword('');
      setConfirmPassword('');
      setShowPasswordSection(false);
    } catch (err: any) {
      toast({ title: 'Error', description: err.message || 'Failed to change password', variant: 'destructive' });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate('/enhanced-auth');
  };

  const getInitials = () => {
    if (fullName) return fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
    return user?.email?.slice(0, 2).toUpperCase() || 'U';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-emerald-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="rounded-lg">
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <h1 className="text-sm font-semibold text-gray-700">Profile Settings</h1>
          <Button variant="ghost" size="sm" onClick={handleSignOut} className="rounded-lg text-red-600 hover:text-red-700 hover:bg-red-50">
            <LogOut className="h-4 w-4 mr-1" /> Sign Out
          </Button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Avatar + Name header */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <div className="w-24 h-24 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center mx-auto mb-4 text-white text-2xl font-bold shadow-lg shadow-emerald-200">
            {getInitials()}
          </div>
          <h2 className="text-xl font-bold text-gray-900">{fullName || 'Set your name'}</h2>
          <p className="text-sm text-gray-500">{user?.email}</p>
          <Badge variant="outline" className="mt-2 capitalize text-xs">{userType}</Badge>
        </motion.div>

        {/* Citizen's own reports with their tokens */}
        {user && <MyReports userId={user.id} />}

        {/* Profile Form */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-emerald-600" />
              Personal Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="fullName">Full Name</Label>
              <Input
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Enter your full name"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="email" className="flex items-center gap-1">
                <Mail className="h-3.5 w-3.5" /> Email
              </Label>
              <Input
                id="email"
                value={user?.email || ''}
                disabled
                className="rounded-xl bg-gray-50 text-gray-500"
              />
              <p className="text-xs text-gray-400">Email cannot be changed</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="flex items-center gap-1">
                <Phone className="h-3.5 w-3.5" /> Phone
              </Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+91 XXXXX XXXXX"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio" className="flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" /> Bio
              </Label>
              <Textarea
                id="bio"
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="Tell us about yourself..."
                className="rounded-xl min-h-[80px]"
                maxLength={200}
              />
              <p className="text-xs text-gray-400 text-right">{bio.length}/200</p>
            </div>

            <Button
              onClick={handleSaveProfile}
              disabled={saving}
              className="w-full bg-emerald-600 hover:bg-emerald-500 rounded-xl h-11"
            >
              {saving ? (
                <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Saving...</>
              ) : (
                <><Save className="h-4 w-4 mr-2" /> Save Changes</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Password Section */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-emerald-600" />
              Security
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!showPasswordSection ? (
              <Button
                variant="outline"
                onClick={() => setShowPasswordSection(true)}
                className="w-full rounded-xl"
              >
                Change Password
              </Button>
            ) : (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-4"
              >
                <div className="space-y-2">
                  <Label>New Password</Label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimum 8 characters"
                      className="rounded-xl pr-10"
                    />
                    <button
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Confirm Password</Label>
                  <Input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="rounded-xl"
                  />
                </div>

                {/* Strength indicators */}
                {newPassword && (
                  <div className="space-y-1">
                    {[
                      { test: newPassword.length >= 8, label: 'At least 8 characters' },
                      { test: /[A-Z]/.test(newPassword), label: 'One uppercase letter' },
                      { test: /[a-z]/.test(newPassword), label: 'One lowercase letter' },
                      { test: /\d/.test(newPassword), label: 'One number' },
                      { test: confirmPassword && newPassword === confirmPassword, label: 'Passwords match' },
                    ].map((req) => (
                      <div key={req.label} className={`text-xs flex items-center gap-1.5 ${req.test ? 'text-emerald-600' : 'text-gray-400'}`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${req.test ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                        {req.label}
                      </div>
                    ))}
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    onClick={handleChangePassword}
                    disabled={changingPassword || newPassword.length < 8 || newPassword !== confirmPassword}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 rounded-xl"
                  >
                    {changingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Update Password'}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => { setShowPasswordSection(false); setNewPassword(''); setConfirmPassword(''); }}
                    className="rounded-xl"
                  >
                    Cancel
                  </Button>
                </div>
              </motion.div>
            )}
          </CardContent>
        </Card>

        {/* Account info */}
        <div className="text-center text-xs text-gray-400 pb-8">
          <p>Account created: {user?.created_at ? new Date(user.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A'}</p>
          <p className="mt-1">User ID: {user?.id?.slice(0, 8)}...</p>
        </div>
      </div>
    </div>
  );
};

export default ProfileSettings;
