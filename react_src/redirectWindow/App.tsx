import { useEffect } from 'react';

/**
 *
 * @returns do NOTHING
 */
const App: React.FC = () => {
    return (
    <div style={{ textAlign: 'center' }}>
        {/* 컨테이너에 relative 설정 */}
        <div style={{ position: 'relative', display: 'inline-block', width: '80%' }}>
            <img
                style={{ width: '100%', display: 'block' }} 
                src="kawai://resources/icons/kawaikara_banner.png"
                alt="banner"
            />
            
            {/* 이미지 위에 겹칠 글자 스타일 */}
            <div style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)', // 정확히 중앙 정렬
                color: 'white',
                fontSize: '20px',
                fontWeight: 'bold',
                textShadow: '2px 2px 4px rgba(0,0,0,0.5)' // 글자가 잘 보이게 그림자 추가
            }}>
                Opened in external browser!
            </div>
        </div>
    </div>
);
};

export default App;
