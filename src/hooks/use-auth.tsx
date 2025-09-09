"use client";

import { useState, useEffect, createContext, useContext } from 'react';
import { 
  User, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import type { Player, Coach } from '@/lib/types';

interface AuthContextType {
  user: User | null;
  userProfile: Player | Coach | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ success: boolean; message: string }>;
  signUp: (email: string, password: string, userData: Partial<Player | Coach>) => Promise<{ success: boolean; message: string }>;
  signOutUser: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ success: boolean; message: string }>;
  updateUserProfile: (data: Partial<Player | Coach>) => Promise<{ success: boolean; message: string }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<Player | Coach | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setUser(user);
      
      if (user) {
        try {
          // Solo obtener el perfil si el email está verificado
          if (user.emailVerified) {
            const userDoc = await getDoc(doc(db, 'players', user.uid));
            if (userDoc.exists()) {
              setUserProfile({ id: user.uid, ...userDoc.data() } as Player);
            } else {
              // Si no es un jugador, intentar como entrenador
              const coachDoc = await getDoc(doc(db, 'coaches', user.uid));
              if (coachDoc.exists()) {
                setUserProfile({ id: user.uid, ...coachDoc.data() } as Coach);
              }
            }
          } else {
            // Si el email no está verificado, no establecer el perfil
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
      
      // Verificar si el email está verificado
      if (!user.emailVerified) {
        // Enviar email de verificación nuevamente si no está verificado
        await sendEmailVerification(user);
        return { 
          success: false, 
          message: 'Tu email no está verificado. Revisa tu bandeja de entrada o spam. Te hemos enviado un nuevo email de verificación.' 
        };
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

  const signUp = async (email: string, password: string, userData: Partial<Player | Coach>) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const newUser = userCredential.user;

      // Actualizar el displayName si está disponible
      if (userData.name) {
        await updateProfile(newUser, { displayName: userData.name });
      }

      // Enviar email de verificación
      await sendEmailVerification(newUser);

      // Determinar la colección basada en el rol
      const role = userData.role || 'player';
      const collection = role === 'coach' ? 'coaches' : 'players';
      
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
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true, message: 'Email de restablecimiento enviado' };
    } catch (error: any) {
      console.error('Error al enviar email de restablecimiento:', error);
      let message = 'Error al enviar email de restablecimiento';
      
      if (error.code === 'auth/user-not-found') {
        message = 'Usuario no encontrado';
      }
      
      return { success: false, message };
    }
  };

  const updateUserProfile = async (data: Partial<Player | Coach>) => {
    try {
      if (!user) {
        return { success: false, message: 'Usuario no autenticado' };
      }

      // Determinar la colección basada en el rol del usuario actual
      const collection = userProfile?.role === 'coach' ? 'coaches' : 'players';
      await setDoc(doc(db, collection, user.uid), data, { merge: true });
      
      // Recargar el perfil del usuario
      if (userProfile) {
        const userDoc = await getDoc(doc(db, collection, user.uid));
        if (userDoc.exists()) {
          const updatedData = userDoc.data();
          setUserProfile({ id: user.uid, ...updatedData } as Player | Coach);
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

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser usado dentro de un AuthProvider');
  }
  return context;
}
