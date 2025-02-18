import { StyleSheet, Image, Platform, Linking, TouchableOpacity, ScrollView, Dimensions } from 'react-native';
import { FontAwesome } from '@expo/vector-icons';
import Animated, { FadeInUp, FadeInRight } from 'react-native-reanimated';
import { BlurView } from 'expo-blur';

import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { SafeAreaView } from 'react-native-safe-area-context';

// Types
interface Collaborator {
  name: string;
  role: string;
  college: string;
  year: string;
  github: string;
  linkedin: string;
  image: string;
  contribution: string;
}

interface SocialButtonProps {
  icon: keyof typeof FontAwesome.glyphMap;
  color: string;
  url: string;
}
const collaborators: Collaborator[] = [
  {
    name: "Pavan Kumar",
    role: "Lead Developer",
    college: "AIT, Pune",
    year: "2027",
    github: "pavankumar07s",
    linkedin: "pavankumr",
    image: "https://github.com/pavankumar07s.png",
    contribution: "React native"
  },
  {
    name: "Pavan Kumar",
    role: "Lead Developer",
    college: "AIT, Pune",
    year: "2027",
    github: "pavankumar07s",
    linkedin: "pavankumr",
    image: "https://github.com/pavankumar07s.png",
    contribution: "React native"
  },
  {
    name: "Pavan Kumar",
    role: "Lead Developer",
    college: "AIT, Pune",
    year: "2027",
    github: "pavankumar07s",
    linkedin: "pavankumr",
    image: "https://github.com/pavankumar07s.png",
    contribution: "React native"
  },
  {
    name: "Pavan Kumar",
    role: "Lead Developer",
    college: "AIT, Pune",
    year: "2027",
    github: "pavankumar07s",
    linkedin: "pavankumr",
    image: "https://github.com/pavankumar07s.png",
    contribution: "React native"
  },
  // Add other team members here
];

// Reusable Components
const SocialButton = ({ icon, color, url }: SocialButtonProps) => (
  <TouchableOpacity 
    onPress={() => Linking.openURL(url)}
    style={styles.socialButton}
  >
    <BlurView intensity={80} style={styles.blurContainer}>
      <FontAwesome name={icon} size={24} color={color} />
    </BlurView>
  </TouchableOpacity>
);

const HeaderSection = () => (
  <Animated.View 
    entering={FadeInUp.duration(800)}
    style={styles.headerContainer}
  >
    <ThemedText type="title" style={styles.pageTitle}>Our Team</ThemedText>
    <ThemedText style={styles.subtitle}>
      Meet the amazing people behind this project
    </ThemedText>
  </Animated.View>
);

const StatBadge = ({ label, value }: { label: string; value: string }) => (
  <ThemedView style={styles.statBadge}>
    <ThemedText style={styles.statLabel}>{label}</ThemedText>
    <ThemedText type="defaultSemiBold" style={styles.statValue}>{value}</ThemedText>
  </ThemedView>
);

const CollaboratorCard = ({ collaborator, index }: { collaborator: Collaborator; index: number }) => (
  <Animated.View 
    entering={FadeInRight.delay(index * 200).duration(800)}
    style={styles.cardWrapper}
  >
    <BlurView intensity={30} style={styles.card}>
      <Image 
        source={{ uri: collaborator.image }} 
        style={styles.avatar}
      />
      <ThemedView style={styles.cardContent}>
        <ThemedText type="title" style={styles.name}>{collaborator.name}</ThemedText>
        <ThemedView style={styles.roleContainer}>
          <ThemedText type="defaultSemiBold" style={styles.role}>{collaborator.role}</ThemedText>
        </ThemedView>
        
        <ThemedView style={styles.statsRow}>
          <StatBadge label="College" value={collaborator.college} />
          <StatBadge label="Year" value={collaborator.year} />
        </ThemedView>

        <ThemedText style={styles.contribution}>{collaborator.contribution}</ThemedText>
        
        <ThemedView style={styles.socialLinks}>
          <SocialButton 
            icon="github" 
            color="#333" 
            url={`https://github.com/${collaborator.github}`}
          />
          <SocialButton 
            icon="linkedin-square" 
            color="#0077b5" 
            url={`https://linkedin.com/in/${collaborator.linkedin}`}
          />
        </ThemedView>
      </ThemedView>
    </BlurView>
  </Animated.View>
);

export default function CollaboratorsScreen() {
  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView 
        style={styles.container}
        showsVerticalScrollIndicator={false}
      >
        <HeaderSection />
        <ThemedView style={styles.cardsContainer}>
          {collaborators.map((collaborator, index) => (
            <CollaboratorCard 
              key={index} 
              collaborator={collaborator} 
              index={index} 
            />
          ))}
        </ThemedView>
      </ScrollView>
    </SafeAreaView>
  );
}

const { width } = Dimensions.get('window');

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  headerContainer: {
    padding: 24,
    paddingBottom: 16,
  },
  pageTitle: {
    fontSize: 36,
    textAlign: 'center',
    marginBottom: 8,
    fontWeight: '800',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: 24,
    opacity: 0.7,
    fontSize: 16,
  },
  cardsContainer: {
    padding: 16,
    gap: 20,
  },
  cardWrapper: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  card: {
    padding: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    overflow: 'hidden',
  },
  blurContainer: {
    borderRadius: 12,
    overflow: 'hidden',
    padding: 10,
  },
  avatar: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#eee',
  },
  cardContent: {
    flex: 1,
    gap: 8,
    padding:4,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
    padding: 4,
  },
  roleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 4,
  },
  role: {
    color: '#1a73e8',
    fontSize: 16,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
    padding: 4,
  },
  statBadge: {
    backgroundColor: '#ffffff15',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    flexDirection: 'column',
    alignItems: 'center',
    padding: 4,
  },
  statLabel: {
    fontSize: 12,
    opacity: 0.6,
  },
  statValue: {
    fontSize: 14,
  },
  contribution: {
    fontSize: 14,
    opacity: 0.8,
    lineHeight: 20,
  },
  socialLinks: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 4,
  },
  socialButton: {
    borderRadius: 12,
    overflow: 'hidden',
    padding: 4,
  },
});