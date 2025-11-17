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
import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "../../firebaseConfig";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";

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
      // Silently ignore saved email load errors
    }
  };

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Erro", "Por favor, preencha todos os campos");
      return;
    }

    setLoading(true);

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

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
});
