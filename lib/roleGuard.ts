"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";

type Client = {
  id: string;
  full_name: string;
};

type Goal = {
  id: string;
  goal_type: string;
  goal_name: string;
  current_score: number;
  target: number;
  status: string;
};