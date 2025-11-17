import React, { createContext, useContext, useState, useEffect } from "react";
import { collection, query, where, getDocs } from "firebase/firestore";
import { db, auth } from "../firebaseConfig";
import { onAuthStateChanged } from "firebase/auth";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CustomThemes } from "../constants/theme";

interface Colmeia {
  id: string;
  name: string;
  inviteCode: string;
  createdBy: string;
  createdAt: any;
}

interface ColmeiaContextType {
  activeColmeia: Colmeia | null;
  setActiveColmeia: (colmeia: Colmeia | null) => void;
  userColmeias: Colmeia[];
  refreshColmeias: () => Promise<void>;
  loading: boolean;
}

const ColmeiaContext = createContext<ColmeiaContextType | undefined>(undefined);

export function ColmeiaProvider({ children }: { children: React.ReactNode }) {
  const [activeColmeia, setActiveColmeiaState] = useState<Colmeia | null>(null);
  const [userColmeias, setUserColmeias] = useState<Colmeia[]>([]);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);

  // Helper para gerar chave no AsyncStorage por usuário (evita colisões e remoções indevidas)
  const getStorageKey = (uid?: string | null) =>
    uid ? `lastActiveColmeia:${uid}` : "lastActiveColmeia";
  // Wrapper para setActiveColmeia que também salva no AsyncStorage
  const setActiveColmeia = async (colmeia: Colmeia | null) => {
    setActiveColmeiaState(colmeia);
    const key = getStorageKey(userId);
    try {
      if (colmeia) {
        await AsyncStorage.setItem(key, colmeia.id);
      } else {
        await AsyncStorage.removeItem(key);
      }
    } catch (err) {
      console.error("Erro salvando colmeia ativa no AsyncStorage:", err);
    }
  };

  const refreshColmeias = async () => {
    const currentUserId = auth.currentUser?.uid;
    if (!currentUserId) {
      // Usuário não autenticado: limpa estado em memória, mas não remove a chave global
      // (evita sobrescrever a preferência durante a inicialização do auth)
      setUserColmeias([]);
      setActiveColmeiaState(null);
      setLoading(false);
      return;
    }

    try {
      setLoading(true);

      // Busca todas as colmeias onde o usuário é membro
      const colmeiasRef = collection(db, "colmeias");
      const colmeiasSnapshot = await getDocs(colmeiasRef);

      const colmeiasWithUser: Colmeia[] = [];

      for (const colmeiaDoc of colmeiasSnapshot.docs) {
        const membersRef = collection(db, "colmeias", colmeiaDoc.id, "members");
        const memberQuery = query(
          membersRef,
          where("userId", "==", currentUserId)
        );
        const memberSnapshot = await getDocs(memberQuery);

        if (!memberSnapshot.empty) {
          colmeiasWithUser.push({
            id: colmeiaDoc.id,
            ...colmeiaDoc.data(),
          } as Colmeia);
        }
      }

      setUserColmeias(colmeiasWithUser);

      // Tenta carregar a última colmeia ativa do AsyncStorage (por usuário)
      const storageKey = getStorageKey(currentUserId);
      const lastColmeiaId = await AsyncStorage.getItem(storageKey);
      if (lastColmeiaId) {
        const lastColmeia = colmeiasWithUser.find(
          (colmeia) => colmeia.id === lastColmeiaId
        );
        if (lastColmeia) {
          setActiveColmeiaState(lastColmeia);
          setLoading(false);
          return; // Sai da função para não sobrescrever com a primeira colmeia
        }
      }

      // Se não há colmeia ativa e não há última colmeia salva, seleciona a primeira
      if (colmeiasWithUser.length > 0 && !activeColmeia) {
        setActiveColmeiaState(colmeiasWithUser[0]);
        try {
          await AsyncStorage.setItem(storageKey, colmeiasWithUser[0].id);
        } catch (err) {
          console.error("Erro salvando colmeia padrão no AsyncStorage:", err);
        }
      }
    } catch (error) {
      console.error("Erro ao buscar colmeias:", error);
    } finally {
      setLoading(false);
    }
  };

  // Monitora mudanças no estado de autenticação
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUserId(user?.uid || null);
    });

    return () => unsubscribe();
  }, []);

  // Carrega colmeias quando o userId muda
  useEffect(() => {
    if (userId) {
      refreshColmeias();
    } else {
      setUserColmeias([]);
      setActiveColmeiaState(null);
      AsyncStorage.removeItem("lastActiveColmeia");
      setLoading(false);
    }
  }, [userId]);

  return (
    <ColmeiaContext.Provider
      value={{
        activeColmeia,
        setActiveColmeia,
        userColmeias,
        refreshColmeias,
        loading,
      }}
    >
      {children}
    </ColmeiaContext.Provider>
  );
}

export function useColmeia() {
  const context = useContext(ColmeiaContext);
  if (context === undefined) {
    throw new Error("useColmeia must be used within a ColmeiaProvider");
  }
  return context;
}

interface ThemeContextType {
  currentTheme: keyof typeof CustomThemes;
  timeOfDay: "dia" | "noite";
  season: "primavera" | "verao" | "outono" | "inverno";
  setTimeOfDay: (time: "dia" | "noite") => void;
  setSeason: (season: "primavera" | "verao" | "outono" | "inverno") => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [timeOfDay, setTimeOfDayState] = useState<"dia" | "noite">("dia");
  const [season, setSeasonState] = useState<
    "primavera" | "verao" | "outono" | "inverno"
  >("primavera");

  const currentTheme = `${season}-${timeOfDay}` as keyof typeof CustomThemes;

  const setTimeOfDay = async (time: "dia" | "noite") => {
    setTimeOfDayState(time);
    await AsyncStorage.setItem("selectedTimeOfDay", time);
  };

  const setSeason = async (
    newSeason: "primavera" | "verao" | "outono" | "inverno"
  ) => {
    setSeasonState(newSeason);
    await AsyncStorage.setItem("selectedSeason", newSeason);
  };

  useEffect(() => {
    const loadTheme = async () => {
      const savedTimeOfDay = await AsyncStorage.getItem("selectedTimeOfDay");
      const savedSeason = await AsyncStorage.getItem("selectedSeason");

      if (
        savedTimeOfDay &&
        (savedTimeOfDay === "dia" || savedTimeOfDay === "noite")
      ) {
        setTimeOfDayState(savedTimeOfDay);
      }

      if (
        savedSeason &&
        ["primavera", "verao", "outono", "inverno"].includes(savedSeason)
      ) {
        setSeasonState(
          savedSeason as "primavera" | "verao" | "outono" | "inverno"
        );
      }
    };
    loadTheme();
  }, []);

  return (
    <ThemeContext.Provider
      value={{ currentTheme, timeOfDay, season, setTimeOfDay, setSeason }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme must be used within a ThemeProvider");
  }
  return context;
}
