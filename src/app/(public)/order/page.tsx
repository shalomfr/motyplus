"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Upload,
  CreditCard,
  Music,
  CheckCircle2,
  FileText,
} from "lucide-react";

interface Organ {
  id: string;
  name: string;
  supportsUpdates: boolean;
}

interface SetType {
  id: string;
  name: string;
  price: number;
  includesUpdates: boolean;
}

interface UpdateVersion {
  id: string;
  version: string;
  price: number;
  description: string | null;
}

export default function OrderPage() {
  // Data
  const [organs, setOrgans] = useState<Organ[]>([]);
  const [sets, setSets] = useState<SetType[]>([]);
  const [updates, setUpdates] = useState<UpdateVersion[]>([]);

  // Form
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [organId, setOrganId] = useState("");
  const [isUpdateOnly, setIsUpdateOnly] = useState(false);
  const [setTypeId, setSetTypeId] = useState("");
  const [updateVersionId, setUpdateVersionId] = useState("");
  const [infoFile, setInfoFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");

  // UI
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/public/organs").then((r) => r.json()),
      fetch("/api/public/sets").then((r) => r.json()),
      fetch("/api/public/updates").then((r) => r.json()),
    ])
      .then(([o, s, u]) => {
        setOrgans(o);
        setSets(s);
        setUpdates(u);
      })
      .finally(() => setLoading(false));
  }, []);

  const selectedSet = sets.find((s) => s.id === setTypeId);
  const selectedUpdate = updates.find((u) => u.id === updateVersionId);
  const totalPrice = isUpdateOnly
    ? Number(selectedUpdate?.price || 0)
    : Number(selectedSet?.price || 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    // Client validation
    if (!fullName || fullName.length < 2) {
      setError("יש להזין שם מלא");
      return;
    }
    if (!phone || phone.length < 9) {
      setError("מספר טלפון לא תקין");
      return;
    }
    if (!email || !email.includes("@")) {
      setError("כתובת מייל לא תקינה");
      return;
    }
    if (!organId) {
      setError("יש לבחור אורגן");
      return;
    }
    if (!isUpdateOnly && !setTypeId) {
      setError("יש לבחור סוג סט");
      return;
    }
    if (isUpdateOnly && !updateVersionId) {
      setError("יש לבחור גרסת עדכון");
      return;
    }
    if (!infoFile) {
      setError("יש להעלות קובץ אינפו (.n27)");
      return;
    }

    setIsSubmitting(true);
    try {
      const fd = new FormData();
      fd.append("fullName", fullName);
      fd.append("phone", phone);
      fd.append("email", email);
      fd.append("organId", organId);
      fd.append("isUpdateOnly", String(isUpdateOnly));
      if (setTypeId) fd.append("setTypeId", setTypeId);
      if (updateVersionId) fd.append("updateVersionId", updateVersionId);
      if (notes) fd.append("notes", notes);
      fd.append("infoFile", infoFile);

      const res = await fetch("/api/public/create-payment", {
        method: "POST",
        body: fd,
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "שגיאה ביצירת ההזמנה");
        return;
      }

      // Redirect to Stripe
      if (data.url) {
        window.location.href = data.url;
      }
    } catch {
      setError("שגיאה בשליחת הטופס");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="text-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800">טופס הזמנה</h2>
        <p className="text-muted-foreground mt-1">
          בחרו את המוצר, העלו קובץ אינפו ועברו לתשלום
        </p>
      </div>

      {/* פרטים אישיים */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <FileText className="h-5 w-5 text-blue-500" />
            פרטים אישיים
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="fullName">שם מלא *</Label>
            <Input
              id="fullName"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder="הזן שם מלא"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="phone">טלפון *</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="050-1234567"
                dir="ltr"
              />
            </div>
            <div>
              <Label htmlFor="email">מייל *</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                dir="ltr"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* בחירת אורגן */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Music className="h-5 w-5 text-purple-500" />
            בחירת אורגן
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={organId} onValueChange={setOrganId}>
            <SelectTrigger>
              <SelectValue placeholder="בחר אורגן" />
            </SelectTrigger>
            <SelectContent>
              {organs.map((organ) => (
                <SelectItem key={organ.id} value={organ.id}>
                  {organ.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* סוג הזמנה */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">סוג הזמנה</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Toggle */}
          <div className="flex gap-2">
            <Button
              type="button"
              variant={!isUpdateOnly ? "default" : "outline"}
              className="flex-1"
              onClick={() => {
                setIsUpdateOnly(false);
                setUpdateVersionId("");
              }}
            >
              רכישת סט
            </Button>
            <Button
              type="button"
              variant={isUpdateOnly ? "default" : "outline"}
              className="flex-1"
              onClick={() => {
                setIsUpdateOnly(true);
                setSetTypeId("");
              }}
            >
              עדכון תוכנה בלבד
            </Button>
          </div>

          {/* Set types */}
          {!isUpdateOnly && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sets.map((set) => (
                <div
                  key={set.id}
                  className={`border-2 rounded-lg p-4 cursor-pointer transition-all ${
                    setTypeId === set.id
                      ? "border-blue-500 bg-blue-50"
                      : "border-gray-200 hover:border-gray-300"
                  }`}
                  onClick={() => setSetTypeId(set.id)}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{set.name}</span>
                    {setTypeId === set.id && (
                      <CheckCircle2 className="h-5 w-5 text-blue-500" />
                    )}
                  </div>
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-xl font-bold text-blue-600">
                      {Number(set.price).toLocaleString()} ₪
                    </span>
                    {set.includesUpdates && (
                      <Badge
                        variant="outline"
                        className="bg-green-50 text-green-700 border-green-300 text-xs"
                      >
                        כולל עדכונים
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Update versions */}
          {isUpdateOnly && (
            <Select value={updateVersionId} onValueChange={setUpdateVersionId}>
              <SelectTrigger>
                <SelectValue placeholder="בחר גרסת עדכון" />
              </SelectTrigger>
              <SelectContent>
                {updates.map((ver) => (
                  <SelectItem key={ver.id} value={ver.id}>
                    {ver.version} — {Number(ver.price).toLocaleString()} ₪
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
        </CardContent>
      </Card>

      {/* העלאת קובץ אינפו */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Upload className="h-5 w-5 text-teal-500" />
            קובץ אינפו
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
              infoFile
                ? "border-green-300 bg-green-50"
                : "border-gray-300 hover:border-blue-300"
            }`}
            onClick={() => document.getElementById("infoFile")?.click()}
          >
            <input
              id="infoFile"
              type="file"
              accept=".n27"
              className="hidden"
              onChange={(e) => setInfoFile(e.target.files?.[0] || null)}
            />
            {infoFile ? (
              <div className="flex items-center justify-center gap-2 text-green-700">
                <CheckCircle2 className="h-5 w-5" />
                <span className="font-medium">{infoFile.name}</span>
                <span className="text-sm text-muted-foreground">
                  ({(infoFile.size / 1024).toFixed(1)} KB)
                </span>
              </div>
            ) : (
              <div>
                <Upload className="h-8 w-8 mx-auto text-gray-400 mb-2" />
                <p className="font-medium text-gray-600">
                  לחצו להעלאת קובץ אינפו (.n27)
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  הקובץ נמצא באורגן שלכם
                </p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* הערות */}
      <Card>
        <CardContent className="pt-6">
          <Label htmlFor="notes">הערות (אופציונלי)</Label>
          <Textarea
            id="notes"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="הערות נוספות..."
            className="mt-2"
          />
        </CardContent>
      </Card>

      {/* שגיאה */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-red-700 text-sm text-center">
          {error}
        </div>
      )}

      {/* סיכום + תשלום */}
      <Card className="bg-blue-50 border-blue-200">
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <span className="font-bold text-lg">סה&quot;כ לתשלום:</span>
            <span className="text-3xl font-bold text-blue-600">
              {totalPrice > 0
                ? `${totalPrice.toLocaleString()} ₪`
                : "—"}
            </span>
          </div>
          <Button
            type="submit"
            className="w-full h-12 text-lg"
            disabled={isSubmitting || totalPrice <= 0}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-5 w-5 ml-2 animate-spin" />
                מעבד...
              </>
            ) : (
              <>
                <CreditCard className="h-5 w-5 ml-2" />
                לתשלום מאובטח
              </>
            )}
          </Button>
          <p className="text-xs text-center text-muted-foreground mt-3">
            התשלום מבוצע באופן מאובטח דרך Stripe
          </p>
        </CardContent>
      </Card>
    </form>
  );
}
