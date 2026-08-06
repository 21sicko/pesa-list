import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <ScrollView style={styles.container} contentContainerStyle={{ padding: 20 }}>
          <Text style={styles.title}>App crashed — here's why:</Text>
          <Text style={styles.error}>{String(this.state.error)}</Text>
          <Text style={styles.stack}>{this.state.errorInfo?.componentStack}</Text>
        </ScrollView>
      );
    }
    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', paddingTop: 50 },
  title: { fontSize: 18, fontWeight: 'bold', color: 'red', marginBottom: 10 },
  error: { fontSize: 14, color: '#333', marginBottom: 20 },
  stack: { fontSize: 11, color: '#666' },
});
