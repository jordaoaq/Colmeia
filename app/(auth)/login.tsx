import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  Image,
  ScrollView,
} from "react-native";
import { Colors } from "@/constants/theme";
import { signInWithEmailAndPassword, signInAnonymously } from "firebase/auth";
import { auth } from "../../firebaseConfig";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

// =====================
// TELA DE LOGIN
// =====================
// Login com email/senha ou modo anônimo para explorar o app
// Palavras-chave: LOGIN, AUTENTICAÇÃO, ANÔNIMO, VISITANTE

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const router = useRouter();

  // Verifica se o usuário já está autenticado
  useEffect(() => {
    const checkAuthState = async () => {
      try {
        const user = auth.currentUser;
        if (user) {
          console.log("Usuário já autenticado:", user.email);
          router.replace("/(app)/home");
        }
      } catch (error) {
        console.error("Erro ao verificar estado de autenticação:", error);
        Alert.alert(
          "Erro",
          "Não foi possível verificar o estado de autenticação. Tente novamente mais tarde."
        );
      }
    };

    checkAuthState();
  }, []);

  // Carrega o email salvo se existir
  useEffect(() => {
    loadSavedEmail();
  }, []);

  const loadSavedEmail = async () => {
    try {
      const savedEmail = await AsyncStorage.getItem("savedEmail");
      const savedRememberMe = await AsyncStorage.getItem("rememberMe");

      if (savedEmail && savedRememberMe === "true") {
        setEmail(savedEmail);
        setRememberMe(true);
      }
    } catch (error) {
      console.log("Erro ao carregar email salvo:", error);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Erro", "Por favor, preencha todos os campos");
      return;
    }

    setLoading(true);
    console.log("Tentando fazer login com:", email);

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );
      console.log("Login bem-sucedido!", userCredential.user.uid);

      // Salva ou remove o email baseado na escolha do usuário
      if (rememberMe) {
        await AsyncStorage.setItem("savedEmail", email);
        await AsyncStorage.setItem("rememberMe", "true");
      } else {
        await AsyncStorage.removeItem("savedEmail");
        await AsyncStorage.removeItem("rememberMe");
      }

      // Redireciona manualmente para a tela home
      router.replace("/(app)/home");
    } catch (error: any) {
      console.error("Erro no login:", error.code, error.message);
      let errorMessage = "Erro ao fazer login";
      if (error.code === "auth/invalid-email") {
        errorMessage = "Email inválido";
      } else if (error.code === "auth/user-not-found") {
        errorMessage = "Usuário não encontrado";
      } else if (error.code === "auth/wrong-password") {
        errorMessage = "Senha incorreta";
      } else if (error.code === "auth/invalid-credential") {
        errorMessage =
          "Credenciais inválidas. Verifique suas informações e tente novamente.";
      }
      Alert.alert("Erro", errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // =====================
  // FUNÇÃO: Login anônimo para explorar o app
  // =====================
  const handleAnonymousLogin = async () => {
    setLoading(true);
    console.log("Tentando fazer login anônimo...");

    try {
      const userCredential = await signInAnonymously(auth);
      console.log("Login anônimo bem-sucedido!", userCredential.user.uid);

      // Redireciona para a tela home
      router.replace("/(app)/home");
    } catch (error: any) {
      console.error("Erro no login anônimo:", error.code, error.message);
      Alert.alert(
        "Erro",
        "Não foi possível entrar como visitante. Tente novamente."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={0}
    >
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={styles.content}>
          <Image
            source={require("../../assets/images/colmeia-title.png")}
            style={[styles.logo, { width: "90%", height: 300 }]}
            resizeMode="contain"
          />
          <Text style={styles.subtitle}>Faça login para continuar</Text>

          <TextInput
            style={styles.input}
            placeholder="Email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            editable={!loading}
          />

          <TextInput
            style={styles.input}
            placeholder="Senha"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            editable={!loading}
          />

          <TouchableOpacity
            style={styles.rememberMeContainer}
            onPress={() => setRememberMe(!rememberMe)}
            disabled={loading}
          >
            <View style={styles.checkbox}>
              {rememberMe && (
                <Ionicons
                  name="checkmark"
                  size={18}
                  color={Colors.light.primary}
                />
              )}
            </View>
            <Text style={styles.rememberMeText}>Lembrar de mim</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Entrar</Text>
            )}
          </TouchableOpacity>

          <View style={styles.dividerContainer}>
            <View style={styles.divider} />
            <Text style={styles.dividerText}>ou</Text>
            <View style={styles.divider} />
          </View>

          <TouchableOpacity
            style={[styles.anonymousButton, loading && styles.buttonDisabled]}
            onPress={handleAnonymousLogin}
            disabled={loading}
          >
            <Ionicons name="eye-outline" size={20} color="#666" />
            <Text style={styles.anonymousButtonText}>
              Explorar como visitante
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => router.push("/(auth)/signup")}
            disabled={loading}
          >
            <Text style={styles.linkText}>
              Não tem uma conta?{" "}
              <Text style={styles.linkTextBold}>Cadastre-se</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scrollView: {
    flex: 1,
    backgroundColor: Colors.light.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    backgroundColor: Colors.light.background,
  },
  content: {
    padding: 24,
    paddingBottom: 40,
    backgroundColor: Colors.light.background,
  },
  title: {
    fontSize: 32,
    fontWeight: "bold",
    color: Colors.light.text,
    marginBottom: 8,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 16,
    color: "#666",
    marginBottom: 32,
    textAlign: "center",
  },
  input: {
    backgroundColor: "#fff",
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 16,
    fontSize: 16,
    borderWidth: 1,
    borderColor: "#ddd",
  },
  rememberMeContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
    gap: 8,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.light.primary,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#fff",
  },
  rememberMeText: {
    fontSize: 14,
    color: Colors.light.text,
  },
  button: {
    backgroundColor: Colors.light.primary,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 8,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "600",
  },
  linkButton: {
    marginTop: 16,
    alignItems: "center",
  },
  linkText: {
    color: "#666",
    fontSize: 14,
  },
  linkTextBold: {
    color: Colors.light.primary,
    fontWeight: "600",
  },
  logo: {
    width: "70%",
    height: 80,
    alignSelf: "center",
    marginBottom: 12,
  },
  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
    gap: 12,
  },
  divider: {
    flex: 1,
    height: 1,
    backgroundColor: "#ddd",
  },
  dividerText: {
    color: "#999",
    fontSize: 14,
    fontWeight: "500",
  },
  anonymousButton: {
    backgroundColor: "#fff",
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: "center",
    marginBottom: 8,
    borderWidth: 1,
    borderColor: "#ddd",
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  anonymousButtonText: {
    color: "#666",
    fontSize: 16,
    fontWeight: "600",
  },
});
