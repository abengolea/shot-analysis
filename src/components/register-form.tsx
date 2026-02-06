"use client"

import { useEffect, useState } from "react";
import { Loader2, Eye, EyeOff } from "lucide-react";

import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";

function SubmitButton({ loading }: { loading: boolean }) {
  return (
    <Button type="submit" className="w-full" disabled={loading}>
      {loading ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Creando Cuenta...
        </>
      ) : (
        "Registrarse"
      )}
    </Button>
  );
}

const registerSchema = z.object({
  name: z.string().min(3, "El nombre debe tener al menos 3 caracteres."),
  email: z.string().email("Por favor, introduce un email válido."),
  password: z.string().min(8, "La contraseña debe tener al menos 8 caracteres."),
  countrySelection: z.enum(['argentina', 'other']),
  countryOther: z.string().trim().max(80, "El país no puede superar 80 caracteres.").optional(),
  club: z.string().trim().max(80, "El club no puede superar 80 caracteres.").optional(),
  province: z.string().trim().max(80, "La provincia no puede superar 80 caracteres.").optional(),
  city: z.string().trim().max(80, "La ciudad no puede superar 80 caracteres.").optional(),
  publicRankingOptIn: z.boolean().optional(),
});

type RegisterFormValues = z.infer<typeof registerSchema>;

export function RegisterForm() {
    const { signUp } = useAuth();
    const { toast } = useToast();
    const [loading, setLoading] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [provinceQuery, setProvinceQuery] = useState("");
    const [cityQuery, setCityQuery] = useState("");
    const [selectedProvinceId, setSelectedProvinceId] = useState<string | null>(null);
    const [showProvinceOptions, setShowProvinceOptions] = useState(false);
    const [showCityOptions, setShowCityOptions] = useState(false);
    const [provinces, setProvinces] = useState<Array<{ id: string; name: string }>>([]);
    const [cities, setCities] = useState<Array<{ id: string; name: string; provinceId: string }>>([]);
    
    const form = useForm<RegisterFormValues>({
        resolver: zodResolver(registerSchema),
        defaultValues: {
            name: "",
            email: "",
            password: "",
            countrySelection: "argentina" as const,
            countryOther: "",
            club: "",
            province: "",
            city: "",
            publicRankingOptIn: false,
        },
    });
    const countrySelection = form.watch("countrySelection");
    const selectedProvinceName = form.watch("province");
    const isArgentina = countrySelection === "argentina";
    const provinceField = form.register("province");
    const cityField = form.register("city");

    useEffect(() => {
        if (countrySelection === "argentina") {
            form.setValue("countryOther", "");
        } else {
            setProvinceQuery("");
            setCityQuery("");
            setSelectedProvinceId(null);
            form.setValue("province", "");
            form.setValue("city", "");
            form.setValue("club", "");
        }
    }, [countrySelection, form]);

    useEffect(() => {
        const parseCsv = (text: string) => {
            const rows: string[][] = [];
            let current = "";
            let inQuotes = false;
            let row: string[] = [];
            for (let i = 0; i < text.length; i++) {
                const char = text[i];
                if (char === '"') {
                    const next = text[i + 1];
                    if (inQuotes && next === '"') {
                        current += '"';
                        i++;
                    } else {
                        inQuotes = !inQuotes;
                    }
                } else if (char === ',' && !inQuotes) {
                    row.push(current);
                    current = "";
                } else if ((char === '\n' || char === '\r') && !inQuotes) {
                    if (current.length > 0 || row.length > 0) {
                        row.push(current);
                        rows.push(row);
                        row = [];
                        current = "";
                    }
                } else {
                    current += char;
                }
            }
            if (current.length > 0 || row.length > 0) {
                row.push(current);
                rows.push(row);
            }
            return rows;
        };

        const loadData = async () => {
            try {
                const [provRes, cityRes] = await Promise.all([
                    fetch("/provincias_FIXED.csv"),
                    fetch("/ciudades_FIXED.csv"),
                ]);
                const [provText, cityText] = await Promise.all([
                    provRes.text(),
                    cityRes.text(),
                ]);
                const provRows = parseCsv(provText).slice(1);
                const cityRows = parseCsv(cityText).slice(1);
                const provData = provRows
                    .map((row) => ({ id: row[0]?.trim(), name: row[1]?.trim() }))
                    .filter((row) => row.id && row.name) as Array<{ id: string; name: string }>;
                const cityData = cityRows
                    .map((row) => ({
                        id: row[0]?.trim(),
                        name: row[1]?.trim(),
                        provinceId: row[2]?.trim(),
                    }))
                    .filter((row) => row.id && row.name && row.provinceId) as Array<{ id: string; name: string; provinceId: string }>;
                setProvinces(provData);
                setCities(cityData);
            } catch {
                // Silencioso: si falla la carga, dejamos inputs libres
            }
        };

        loadData();
    }, []);

    const normalizeText = (value: string) =>
        value
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "");

    const filteredProvinces = provinces
        .filter((province) => {
            if (!provinceQuery.trim()) return true;
            return normalizeText(province.name).includes(normalizeText(provinceQuery));
        })
        .slice(0, 8);

    const filteredCities = cities
        .filter((city) => {
            if (!selectedProvinceId) return false;
            if (city.provinceId !== selectedProvinceId) return false;
            if (!cityQuery.trim()) return true;
            return normalizeText(city.name).includes(normalizeText(cityQuery));
        })
        .slice(0, 8);

    const onSubmit = async (data: RegisterFormValues) => {
        setLoading(true);
        try {
            const clubValue = data.club?.trim() || "";
            const provinceValue = data.province?.trim() || "";
            const cityValue = data.city?.trim() || "";
            const countryValue = data.countrySelection === "argentina"
                ? "Argentina"
                : (data.countryOther?.trim() || "");
            const userData = {
                name: data.name,
                role: 'player' as const,
                publicRankingOptIn: !!data.publicRankingOptIn,
                ...(countryValue ? { country: countryValue } : {}),
                ...(data.countrySelection === "argentina" && clubValue ? { club: clubValue } : {}),
                ...(data.countrySelection === "argentina" && provinceValue ? { province: provinceValue } : {}),
                ...(data.countrySelection === "argentina" && cityValue ? { city: cityValue } : {}),
            };

            const result = await signUp(data.email, data.password, userData);
            
            if (result.success) {
                toast({
                    title: "¡Cuenta creada!",
                    description: result.message,
                });
                
                // Redirigir a la página de verificación de email
                window.location.href = '/verify-email';
            } else {
                toast({
                    title: "Error de registro",
                    description: result.message,
                    variant: "destructive",
                });
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "Ocurrió un error inesperado",
                variant: "destructive",
            });
        } finally {
            setLoading(false);
        }
    };

  return (
    <form onSubmit={form.handleSubmit(onSubmit)} className="w-full space-y-6">
        <Card className="w-full">
            <CardHeader>
                <CardTitle>Crear Cuenta</CardTitle>
                <CardDescription>
                   Completa la información básica para crear tu cuenta.
                </CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Nombre Completo</Label>
                    <Input 
                        id="name" 
                        placeholder="Tu nombre" 
                        {...form.register("name")}
                    />
                    {form.formState.errors.name && (
                        <p className="text-sm text-destructive">{form.formState.errors.name.message}</p>
                    )}
                </div>
                <div className="space-y-2">
                    <Label htmlFor="countrySelection">¿Sos de Argentina?</Label>
                    <Select
                        value={countrySelection}
                        onValueChange={(value) => form.setValue("countrySelection", value as RegisterFormValues["countrySelection"])}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Seleccionar" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="argentina">Sí</SelectItem>
                            <SelectItem value="other">No</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                {countrySelection === "other" && (
                <div className="space-y-2">
                    <Label htmlFor="countryOther">País</Label>
                    <Input
                        id="countryOther"
                        placeholder="Tu país"
                        {...form.register("countryOther")}
                    />
                    {form.formState.errors.countryOther && (
                        <p className="text-sm text-destructive">{form.formState.errors.countryOther.message}</p>
                    )}
                </div>
                )}
                {isArgentina && (
                <div className="space-y-2">
                    <Label htmlFor="club">Club (opcional)</Label>
                    <Input
                        id="club"
                        placeholder="Nombre de tu club"
                        {...form.register("club")}
                    />
                    {form.formState.errors.club && (
                        <p className="text-sm text-destructive">{form.formState.errors.club.message}</p>
                    )}
                </div>
                )}
                {isArgentina && (
                <div className="space-y-2">
                    <Label htmlFor="province">Provincia (opcional)</Label>
                    <div className="relative">
                        <Input
                            id="province"
                            placeholder="Escribe tu provincia"
                            value={provinceQuery}
                            onChange={(event) => {
                                provinceField.onChange(event);
                                const nextValue = event.target.value;
                                setProvinceQuery(nextValue);
                                form.setValue("province", nextValue);
                                setShowProvinceOptions(true);
                                setSelectedProvinceId(null);
                                setCityQuery("");
                                form.setValue("city", "");
                            }}
                            name={provinceField.name}
                            ref={provinceField.ref}
                            onFocus={() => setShowProvinceOptions(true)}
                            onBlur={() => {
                                const match = provinces.find(
                                    (province) => normalizeText(province.name) === normalizeText(provinceQuery)
                                );
                                if (match) {
                                    setProvinceQuery(match.name);
                                    form.setValue("province", match.name, { shouldValidate: true });
                                    setSelectedProvinceId(match.id);
                                }
                                setTimeout(() => setShowProvinceOptions(false), 150);
                            }}
                        />
                        {showProvinceOptions && filteredProvinces.length > 0 && (
                            <div className="absolute z-20 mt-1 w-full rounded-md border bg-white shadow-sm max-h-56 overflow-auto">
                                {filteredProvinces.map((province) => (
                                    <button
                                        key={province.id}
                                        type="button"
                                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={() => {
                                            setProvinceQuery(province.name);
                                            form.setValue("province", province.name, { shouldValidate: true });
                                            setSelectedProvinceId(province.id);
                                            setShowProvinceOptions(false);
                                            setCityQuery("");
                                            form.setValue("city", "");
                                        }}
                                    >
                                        {province.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    {!selectedProvinceId && provinceQuery.trim() && (
                        <p className="text-xs text-muted-foreground">
                            Seleccioná una provincia de la lista para continuar.
                        </p>
                    )}
                    {form.formState.errors.province && (
                        <p className="text-sm text-destructive">{form.formState.errors.province.message}</p>
                    )}
                </div>
                )}
                {isArgentina && (
                <div className="space-y-2">
                    <Label htmlFor="city">Ciudad (opcional)</Label>
                    <div className="relative">
                        <Input
                            id="city"
                            placeholder={selectedProvinceId ? "Escribe tu ciudad" : "Primero elige una provincia"}
                            value={cityQuery}
                            onChange={(event) => {
                                cityField.onChange(event);
                                const nextValue = event.target.value;
                                setCityQuery(nextValue);
                                form.setValue("city", nextValue);
                                setShowCityOptions(true);
                            }}
                            name={cityField.name}
                            ref={cityField.ref}
                            onFocus={() => setShowCityOptions(true)}
                            onBlur={() => setTimeout(() => setShowCityOptions(false), 150)}
                            disabled={!selectedProvinceId}
                        />
                        {showCityOptions && filteredCities.length > 0 && (
                            <div className="absolute z-20 mt-1 w-full rounded-md border bg-white shadow-sm max-h-56 overflow-auto">
                                {filteredCities.map((city) => (
                                    <button
                                        key={city.id}
                                        type="button"
                                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={() => {
                                            setCityQuery(city.name);
                                            form.setValue("city", city.name, { shouldValidate: true });
                                            setShowCityOptions(false);
                                        }}
                                    >
                                        {city.name}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                    {selectedProvinceName && !selectedProvinceId && (
                        <p className="text-xs text-muted-foreground">
                            Elegí una provincia de la lista para habilitar ciudades.
                        </p>
                    )}
                    {form.formState.errors.city && (
                        <p className="text-sm text-destructive">{form.formState.errors.city.message}</p>
                    )}
                </div>
                )}
                 <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input 
                        id="email" 
                        type="email" 
                        placeholder="tu@email.com" 
                        {...form.register("email")}
                    />
                    {form.formState.errors.email && (
                        <p className="text-sm text-destructive">{form.formState.errors.email.message}</p>
                    )}
                </div>
                
                
                 <div className="space-y-2">
                    <Label htmlFor="password">Contraseña</Label>
                    <div className="relative">
                        <Input 
                            id="password" 
                            type={showPassword ? "text" : "password"} 
                            placeholder="Tu contraseña segura" 
                            {...form.register("password")}
                        />
                        <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 transform -translate-y-1/2"
                        >
                            {showPassword ? (
                                <EyeOff className="h-4 w-4 text-gray-500" />
                            ) : (
                                <Eye className="h-4 w-4 text-gray-500" />
                            )}
                        </button>
                    </div>
                    {form.formState.errors.password && (
                        <p className="text-sm text-destructive">{form.formState.errors.password.message}</p>
                    )}
                </div>
                <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <p className="text-sm text-blue-700">
                        💡 <strong>Nota:</strong> Solo necesitamos estos datos básicos para crear tu cuenta. 
                        Podrás completar tu perfil completo después del registro.
                    </p>
                </div>
            </CardContent>
            <CardFooter className="flex flex-col items-stretch">
               <SubmitButton loading={loading} />
            </CardFooter>
        </Card>
    </form>
  )
}
