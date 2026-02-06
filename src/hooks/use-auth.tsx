"use client";

import { useState, useEffect, createContext, useContext } from 'react';
import { 
  User, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  updateProfile
} from 'firebase/auth';
import { requestVerificationEmail, requestPasswordReset } from '@/app/actions';
import { addDoc, collection, doc, getDoc, getDocs, query, setDoc, where } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { Player, Coach, Club } from '@/lib/types';

interface AuthContextType {
  user: User | null;
  userProfile: Player | Coach | Club | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  signUp: (email: string, password: string, userData: Partial<Player | Coach | Club>) => Promise<{ success: boolean; message: string }>;
  signOutUser: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; message: string }>;
  updateUserProfile: (data: Partial<Player | Coach | Club>) => Promise<{ success: boolean; message: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<Player | Coach | Club | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (user) {
        try {
          // Determinar preferencia de rol según ruta y preferencia guardada
          const pathname = typeof window !== 'undefined' ? window.location.pathname : '';
          const storedRole = typeof window !== 'undefined'
            ? (localStorage.getItem('preferredRole') || '')
            : '';
          const pathRole = pathname.startsWith('/coach')
            ? 'coach'
            : pathname.startsWith('/club')
              ? 'club'
              : (
                pathname.startsWith('/player') ||
                pathname.startsWith('/dashboard') ||
                pathname.startsWith('/upload') ||
                pathname.startsWith('/profile') ||
                pathname.startsWith('/coaches')
              )
                ? 'player'
                : '';

          // Cargar ambos perfiles en paralelo para decidir correctamente cuando existen los dos
          const [playerSnap, coachSnap, clubSnap] = await Promise.all([
            getDoc(doc(db, 'players', user.uid)),
            getDoc(doc(db, 'coaches', user.uid)),
            getDoc(doc(db, 'clubs', user.uid)),
          ]);

          const hasCoach = coachSnap.exists();
          const hasPlayer = playerSnap.exists();
          const hasClub = clubSnap.exists();
          const requestedRole = (storedRole || pathRole) as 'coach' | 'player' | 'club' | '';
          let resolvedRole: 'coach' | 'player' | 'club' | '' = '';
          let selected: (Player | Coach | Club) | null = null;

          if (requestedRole === 'coach') {
            resolvedRole = hasCoach ? 'coach' : (hasPlayer ? 'player' : '');
          } else if (requestedRole === 'club') {
            resolvedRole = hasClub ? 'club' : (hasCoach ? 'coach' : (hasPlayer ? 'player' : ''));
          } else if (requestedRole === 'player') {
            resolvedRole = hasPlayer ? 'player' : (hasCoach ? 'coach' : (hasClub ? 'club' : ''));
          } else if (hasClub) {
            // Si no hay preferencia explícita y existe rol de club, usar club por defecto
            resolvedRole = 'club';
          } else if (hasCoach && hasPlayer) {
            // Si tiene doble rol y no hay preferencia explícita, quedarse en coach por defecto
            resolvedRole = 'coach';
          } else if (hasCoach) {
            resolvedRole = 'coach';
          } else if (hasPlayer) {
            resolvedRole = 'player';
          }

          if (resolvedRole === 'coach' && hasCoach) {
            const data = coachSnap.data() as any;
            selected = { id: user.uid, ...(data as any) } as Coach;
          } else if (resolvedRole === 'club' && hasClub) {
            const data = clubSnap.data() as any;
            selected = { id: user.uid, ...(data as any) } as Club;
          } else if (resolvedRole === 'player' && hasPlayer) {
            const data = playerSnap.data() as any;
            selected = { id: user.uid, ...(data as any) } as Player;
          }

          const selectedRole = (selected as any)?.role as string | undefined;
          if (selected && (user.emailVerified || selectedRole === 'admin')) {
            try {
              if (typeof window !== 'undefined' && (selectedRole === 'coach' || selectedRole === 'player' || selectedRole === 'club')) {
                localStorage.setItem('preferredRole', selectedRole);
              }
            } catch {}
            setUserProfile(selected);
          } else {
            setUserProfile(null);
          }
        } catch (error) {
          console.error('Error obteniendo perfil del usuario:', error);
        }
      } else {
        setUserProfile(null);
      }
      
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Si el email no está verificado, permitir sólo si el rol del perfil en Firestore es 'admin'
      if (!user.emailVerified) {
        let role: string | undefined;
        try {
          const pSnap = await getDoc(doc(db, 'players', user.uid));
          if (pSnap.exists()) role = (pSnap.data() as any)?.role;
          if (!role) {
            const cSnap = await getDoc(doc(db, 'coaches', user.uid));
            if (cSnap.exists()) role = (cSnap.data() as any)?.role;
          }
          if (!role) {
            const clubSnap = await getDoc(doc(db, 'clubs', user.uid));
            if (clubSnap.exists()) role = (clubSnap.data() as any)?.role;
          }
        } catch {}
        if (role !== 'admin' && user.email) {
          await requestVerificationEmail(user.email);
          return {
            success: false,
            message: 'Tu email no está verificado. Revisa tu bandeja de entrada o spam. Te hemos enviado un nuevo email de verificación.'
          };
        }
      }
      
      // Marcar el status como 'active' al confirmar email verificado
      try {
        // Intentar actualizar en players; si no existe, en coaches
        const playerRef = doc(db, 'players', user.uid);
        const playerSnap = await getDoc(playerRef);
        if (playerSnap.exists()) {
          await setDoc(playerRef, { status: 'active', updatedAt: new Date() }, { merge: true });
        } else {
          const coachRef = doc(db, 'coaches', user.uid);
          const coachSnap = await getDoc(coachRef);
          if (coachSnap.exists()) {
            await setDoc(coachRef, { status: 'active', updatedAt: new Date() }, { merge: true });
          } else {
            const clubRef = doc(db, 'clubs', user.uid);
            const clubSnap = await getDoc(clubRef);
            if (clubSnap.exists()) {
              await setDoc(clubRef, { status: 'active', updatedAt: new Date() }, { merge: true });
            }
          }
        }
      } catch (e) {
        console.warn('No se pudo actualizar el status a active:', e);
      }

      return { success: true, message: 'Inicio de sesión exitoso' };
    } catch (error: any) {
      console.error('Error de inicio de sesión:', error);
      let message = 'Error al iniciar sesión';
      
      switch (error.code) {
        case 'auth/user-not-found':
          message = 'Usuario no encontrado';
          break;
        case 'auth/wrong-password':
          message = 'Contraseña incorrecta';
          break;
        case 'auth/invalid-email':
          message = 'Email inválido';
          break;
        case 'auth/too-many-requests':
          message = 'Demasiados intentos fallidos. Intenta más tarde';
          break;
        case 'auth/configuration-not-found':
          message = 'Error de configuración de Firebase. Contacta al administrador.';
          break;
        default:
          message = error.message || 'Error desconocido';
      }
      
      return { success: false, message };
    }
  };

  const signUp = async (email: string, password: string, userData: Partial<Player | Coach | Club>) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;

      // Actualizar el displayName si está disponible
      if (userData.name) {
        await updateProfile(newUser, { displayName: userData.name });
      }

      // Enviar email de verificación (template + redirect al entorno actual)
      await requestVerificationEmail(email);

      // Determinar la colección basada en el rol
      const role = userData.role || 'player';
      
      // Preparar los datos base del usuario (status: pending hasta verificar email)
      const baseUserData = {
        id: newUser.uid,
        name: userData.name || '',
        email,
        role,
        avatarUrl: 'https://placehold.co/100x100.png',
        status: 'pending' as const, // Pendiente de verificación
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      if (role === 'player') {
        // Es un jugador - datos básicos + opt-in de ranking si se envió
        await setDoc(doc(db, 'players', newUser.uid), {
          ...baseUserData,
          ...(typeof (userData as any).publicRankingOptIn === 'boolean'
            ? { publicRankingOptIn: Boolean((userData as any).publicRankingOptIn) }
            : {}),
          ...(typeof (userData as any).club === 'string' && (userData as any).club.trim()
            ? { club: (userData as any).club.trim() }
            : {}),
          ...(typeof (userData as any).country === 'string' && (userData as any).country.trim()
            ? { country: (userData as any).country.trim() }
            : {}),
          ...(typeof (userData as any).province === 'string' && (userData as any).province.trim()
            ? { province: (userData as any).province.trim() }
            : {}),
          ...(typeof (userData as any).city === 'string' && (userData as any).city.trim()
            ? { city: (userData as any).city.trim() }
            : {}),
        });
        const clubName = typeof (userData as any).club === 'string' ? (userData as any).club.trim() : '';
        if (clubName) {
          const normalizedName = normalizeClubName(clubName);
          let clubExists = false;
          try {
            const byNormalized = query(collection(db, 'clubs'), where('nameLower', '==', normalizedName));
            const byNormalizedSnap = await getDocs(byNormalized);
            clubExists = !byNormalizedSnap.empty;
          } catch {}
          if (!clubExists) {
            try {
              const byExact = query(collection(db, 'clubs'), where('name', '==', clubName));
              const byExactSnap = await getDocs(byExact);
              clubExists = !byExactSnap.empty;
            } catch {}
          }
          if (!clubExists) {
            try {
              const pendingReq = query(
                collection(db, 'club_requests'),
                where('normalizedName', '==', normalizedName),
                where('status', '==', 'pending')
              );
              const pendingSnap = await getDocs(pendingReq);
              if (pendingSnap.empty) {
                await addDoc(collection(db, 'club_requests'), {
                  proposedName: clubName,
                  normalizedName,
                  playerId: newUser.uid,
                  playerEmail: email,
                  playerName: userData.name || '',
                  status: 'pending',
                  createdAt: new Date().toISOString(),
                });
              }
            } catch {}
          }
        }
      } else if (role === 'club') {
        // Es un club - datos básicos
        await setDoc(doc(db, 'clubs', newUser.uid), {
          ...baseUserData,
          ...(typeof (userData as any).city === 'string' && (userData as any).city.trim()
            ? { city: (userData as any).city.trim() }
            : {}),
        });
      } else {
        // Es un entrenador - solo datos básicos
        await setDoc(doc(db, 'coaches', newUser.uid), {
          ...baseUserData,
          // Los demás campos se completarán en el perfil
        });
      }

      return { 
        success: true, 
        message: 'Cuenta creada exitosamente. Revisa tu email para activar tu cuenta.' 
      };
    } catch (error: any) {
      console.error('Error de registro:', error);
      let message = 'Error al crear la cuenta';
      
      switch (error.code) {
        case 'auth/email-already-in-use':
          message = 'Este email ya está en uso';
          break;
        case 'auth/weak-password':
          message = 'La contraseña es muy débil';
          break;
        case 'auth/invalid-email':
          message = 'Email inválido';
          break;
        case 'auth/configuration-not-found':
          message = 'Error de configuración de Firebase. Contacta al administrador.';
          break;
        default:
          message = error.message || 'Error desconocido';
      }
      
      return { success: false, message };
    }
  };

  const signOutUser = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error al cerrar sesión:', error);
    }
  };

  const resetPassword = async (email: string) => {
    const res = await requestPasswordReset(email);
    return res;
  };

  const updateUserProfile = async (data: Partial<Player | Coach | Club>) => {
    try {
      if (!user) {
        return { success: false, message: 'Usuario no autenticado' };
      }

      // Determinar la colección basada en el rol del usuario actual
      const collection = userProfile?.role === 'coach'
        ? 'coaches'
        : userProfile?.role === 'club'
          ? 'clubs'
          : 'players';
      await setDoc(doc(db, collection, user.uid), data, { merge: true });
      
      // Recargar el perfil del usuario
      if (userProfile) {
        const userDoc = await getDoc(doc(db, collection, user.uid));
        if (userDoc.exists()) {
          const updatedData = userDoc.data();
          setUserProfile({ id: user.uid, ...updatedData } as Player | Coach | Club);
        }
      }
      
      return { success: true, message: 'Perfil actualizado exitosamente' };
    } catch (error) {
      console.error('Error al actualizar perfil:', error);
      return { success: false, message: 'Error al actualizar perfil' };
    }
  };

  const value = {
    user,
    userProfile,
    loading,
    signIn,
    signUp,
    signOutUser,
    resetPassword,
    updateUserProfile
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

const normalizeClubName = (value: string) =>
  value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
}
