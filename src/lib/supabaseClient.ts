import { createClient } from '@supabase/supabase-js';

// 下記のURLとAPIキーはご自身のSupabaseプロジェクトのものに書き換えてください
const supabaseUrl = 'https://grygxftqqqzeqkvqvdde.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImdyeWd4ZnRxcXF6ZXFrdnF2ZGRlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTc2NTg3OTIsImV4cCI6MjA3MzIzNDc5Mn0.rbzARiGtpL7WPshSdTc9O30gkQSeTfCi47b0Mco9Yjk';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
