import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = DinPulsStatusBarContainer()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

// Reserve UIKit's actual safe area on every page, including after navigation.
class DinPulsStatusBarContainer: UIViewController {
    private let content = DinPulsViewController()
    override var preferredStatusBarStyle: UIStatusBarStyle { .lightContent }
    override func viewDidLoad() {
        super.viewDidLoad()
        view.backgroundColor = .black
        addChild(content)
        view.addSubview(content.view)
        content.view.translatesAutoresizingMaskIntoConstraints = false
        NSLayoutConstraint.activate([
            content.view.topAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
            content.view.leadingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.leadingAnchor),
            content.view.trailingAnchor.constraint(equalTo: view.safeAreaLayoutGuide.trailingAnchor),
            content.view.bottomAnchor.constraint(equalTo: view.bottomAnchor)
        ])
        content.didMove(toParent: self)
    }
}

class DinPulsViewController: CAPBridgeViewController {
    override func viewDidLoad() {
        super.viewDidLoad()
        statusBarStyle = .lightContent
        webView?.backgroundColor = .black
        webView?.scrollView.backgroundColor = .black
        setNeedsStatusBarAppearanceUpdate()
        #if IOS_CI
        if ProcessInfo.processInfo.arguments.contains("--dinpuls-ci"), Bundle.main.path(forResource: "e2e-bridge", ofType: "js", inDirectory: "public") != nil { pollCI() }
        #endif
    }

    #if IOS_CI
    // Only in the isolated simulator build; absent from distributed binaries.
    private func pollCI() {
        URLSession.shared.dataTask(with: URL(string: "http://127.0.0.1:8788/__test/command")!) { data, _, _ in
            if let data = data, let command = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
               let id = command["id"] as? Int, let script = command["script"] as? String {
                DispatchQueue.main.async {
                    let nativeTop = self.view.convert(self.view.bounds, to: self.view.window).minY
                    self.webView?.evaluateJavaScript("window.__dinpulsCINativeTop = \(nativeTop);\n" + script) { value, error in
                        var request = URLRequest(url: URL(string: "http://127.0.0.1:8788/__test/result")!)
                        request.httpMethod = "POST"
                        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
                        request.httpBody = try? JSONSerialization.data(withJSONObject: ["id": id, "value": value ?? NSNull(), "error": error?.localizedDescription ?? ""])
                        URLSession.shared.dataTask(with: request) { _, _, _ in self.nextCI() }.resume()
                    }
                }
            } else { self.nextCI() }
        }.resume()
    }
    private func nextCI() { DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { self.pollCI() } }
    #endif
}
